import prisma from "./prisma";
import { normalizeEmail } from "./validation";

export type SuppressionCategory =
  | "hard_bounce"
  | "soft_bounce"
  | "complaint"
  | "unsubscribe"
  | "admin_suppression"
  | "invalid_syntax";

export interface SuppressionCheckResult {
  isSuppressed: boolean;
  category?: SuppressionCategory;
  reason?: string;
  entryDate?: Date;
}

/**
 * Atomic pre-send check against the global suppression registry.
 * This MUST be called prior to transmitting any email.
 */
export async function checkSuppression(rawEmail: string): Promise<SuppressionCheckResult> {
  const normalized = normalizeEmail(rawEmail);
  if (!normalized) {
    return {
      isSuppressed: true,
      category: "invalid_syntax",
      reason: "Email is empty or invalid",
    };
  }

  const entry = await prisma.suppressionEntry.findUnique({
    where: { email: normalized },
  });

  if (entry) {
    return {
      isSuppressed: true,
      category: entry.category as SuppressionCategory,
      reason: entry.reason,
      entryDate: entry.createdAt,
    };
  }

  // Also check if contact has explicit un-subscribed or complained status
  const contact = await prisma.contact.findUnique({
    where: { normalizedEmail: normalized },
    select: { status: true },
  });

  if (contact) {
    if (contact.status === "unsubscribed") {
      return {
        isSuppressed: true,
        category: "unsubscribe",
        reason: "Contact record is marked as unsubscribed",
      };
    }
    if (contact.status === "complained") {
      return {
        isSuppressed: true,
        category: "complaint",
        reason: "Contact record has spam complaint registered",
      };
    }
  }

  return { isSuppressed: false };
}

/**
 * Register an email address into the global suppression registry
 */
export async function suppressEmail(params: {
  email: string;
  category: SuppressionCategory;
  reason: string;
  source?: string;
  providerMessageId?: string;
  createdBy?: string;
}) {
  const normalized = normalizeEmail(params.email);
  if (!normalized) return null;

  // 1. Upsert suppression entry
  const entry = await prisma.suppressionEntry.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      category: params.category,
      reason: params.reason,
      source: params.source || "system",
      providerMessageId: params.providerMessageId || null,
      createdBy: params.createdBy || null,
    },
    update: {
      category: params.category,
      reason: params.reason,
      source: params.source || "system",
      providerMessageId: params.providerMessageId || null,
      createdBy: params.createdBy || null,
      createdAt: new Date(),
    },
  });

  // 2. Reflect on Contact status
  const contactStatus =
    params.category === "hard_bounce" || params.category === "soft_bounce"
      ? "bounced"
      : params.category === "complaint"
      ? "complained"
      : params.category === "unsubscribe"
      ? "unsubscribed"
      : undefined;

  if (contactStatus) {
    await prisma.contact.updateMany({
      where: { normalizedEmail: normalized },
      data: { status: contactStatus },
    });
  }

  return entry;
}

/**
 * Record a bounce event with automated soft/hard bounce thresholds
 */
export async function handleBounceEvent(params: {
  email: string;
  bounceType: "Permanent" | "Transient" | "Undetermined";
  subType?: string;
  diagnosticCode?: string;
  providerMessageId?: string;
}) {
  const normalized = normalizeEmail(params.email);
  if (!normalized) return;

  if (params.bounceType === "Permanent") {
    // Permanent = Hard Bounce: Immediate permanent suppression
    await suppressEmail({
      email: normalized,
      category: "hard_bounce",
      reason: `SES Hard Bounce (${params.subType || "General"}): ${params.diagnosticCode || "Permanent delivery failure"}`,
      source: "ses_webhook",
      providerMessageId: params.providerMessageId,
    });
  } else {
    // Transient = Soft Bounce: Increment count and suppress after threshold
    const settings = await prisma.applicationSettings.findUnique({ where: { id: "default" } });
    const maxSoftBounces = settings?.maxSoftBounces ?? 3;

    const contact = await prisma.contact.findUnique({
      where: { normalizedEmail: normalized },
    });

    const currentCount = (contact?.bounceCount ?? 0) + 1;

    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { bounceCount: currentCount },
      });
    }

    if (currentCount >= maxSoftBounces) {
      await suppressEmail({
        email: normalized,
        category: "soft_bounce",
        reason: `Exceeded soft bounce limit (${currentCount}/${maxSoftBounces}): ${params.diagnosticCode || "Repeated transient delivery failure"}`,
        source: "ses_webhook",
        providerMessageId: params.providerMessageId,
      });
    }
  }
}

/**
 * Record a recipient spam complaint
 */
export async function handleComplaintEvent(params: {
  email: string;
  complaintFeedbackType?: string;
  providerMessageId?: string;
}) {
  const normalized = normalizeEmail(params.email);
  if (!normalized) return;

  await suppressEmail({
    email: normalized,
    category: "complaint",
    reason: `SES Feedback Loop Complaint (${params.complaintFeedbackType || "abuse"})`,
    source: "ses_webhook",
    providerMessageId: params.providerMessageId,
  });
}

/**
 * Record an explicit unsubscribe
 */
export async function handleUnsubscribeEvent(params: {
  email: string;
  reason?: string;
  source?: string;
  campaignId?: string;
}) {
  const normalized = normalizeEmail(params.email);
  if (!normalized) return;

  await suppressEmail({
    email: normalized,
    category: "unsubscribe",
    reason: params.reason || "Recipient requested unsubscribe",
    source: params.source || "user_unsubscribe",
  });
}

/**
 * Administrative unsuppression with mandatory audit logging
 */
export async function unsuppressEmail(params: {
  id: string;
  adminUserId: string;
  reason: string;
  forceOverride?: boolean;
}) {
  const entry = await prisma.suppressionEntry.findUnique({
    where: { id: params.id },
  });

  if (!entry) {
    throw new Error("Suppression entry not found");
  }

  // Safety safeguard: Never remove complaint or unsubscribe without explicit override
  if ((entry.category === "complaint" || entry.category === "unsubscribe") && !params.forceOverride) {
    throw new Error(
      `Cannot unsuppress ${entry.category} without explicit recipient re-opt-in confirmation.`
    );
  }

  // Delete suppression entry
  await prisma.suppressionEntry.delete({
    where: { id: params.id },
  });

  // Reset contact status back to subscribed if appropriate
  await prisma.contact.updateMany({
    where: { normalizedEmail: entry.email },
    data: { status: "subscribed", bounceCount: 0 },
  });

  // Log audit entry
  await prisma.auditLog.create({
    data: {
      userId: params.adminUserId,
      action: "unsuppress_recipient",
      resourceType: "suppression",
      resourceId: entry.id,
      details: JSON.stringify({
        email: entry.email,
        originalCategory: entry.category,
        adminReason: params.reason,
        forceOverride: params.forceOverride || false,
      }),
    },
  });

  return { success: true, email: entry.email };
}
