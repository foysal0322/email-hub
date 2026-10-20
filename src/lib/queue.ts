import prisma from "./prisma";
import { checkSuppression, suppressEmail } from "./suppression";
import { renderPersonalizedString, buildTokenDictionary } from "./personalization";
import { prepareTrackedEmailContent } from "./tracking";
import { sendMail } from "./smtp";

// In-memory worker state tracking
let isWorkerRunning = false;
let activeCampaignId: string | null = null;
let lastWorkerPulse = new Date();

export function getWorkerStatus() {
  return {
    isRunning: isWorkerRunning,
    activeCampaignId,
    lastPulse: lastWorkerPulse,
  };
}

/**
 * Freeze audience snapshot into CampaignRecipient table and transition to queued
 */
export async function prepareCampaignAudience(
  campaignId: string,
  options?: { sourceCampaignId?: string }
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new Error("Campaign not found");

  // Fetch contacts: from assigned contact list, or source campaign recipients, or all subscribed contacts
  let contacts;
  if (campaign.contactListId) {
    contacts = await prisma.contact.findMany({
      where: {
        status: "subscribed",
        listMemberships: { some: { listId: campaign.contactListId } },
      },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        fullName: true,
        firstName: true,
        lastName: true,
        department: true,
        organization: true,
        jobTitle: true,
        phone: true,
        customAttributes: true,
      },
    });
  } else if (options?.sourceCampaignId) {
    const sourceRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: options.sourceCampaignId },
      select: { contactId: true, email: true },
    });
    const contactIds = sourceRecipients.map((r) => r.contactId).filter(Boolean) as string[];
    const emails = sourceRecipients.map((r) => r.email.toLowerCase().trim());

    contacts = await prisma.contact.findMany({
      where: {
        status: "subscribed",
        OR: [
          { id: { in: contactIds } },
          { normalizedEmail: { in: emails } },
        ],
      },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        fullName: true,
        firstName: true,
        lastName: true,
        department: true,
        organization: true,
        jobTitle: true,
        phone: true,
        customAttributes: true,
      },
    });
  } else {
    contacts = await prisma.contact.findMany({
      where: {
        status: "subscribed",
      },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        fullName: true,
        firstName: true,
        lastName: true,
        department: true,
        organization: true,
        jobTitle: true,
        phone: true,
        customAttributes: true,
      },
    });
  }

  // Deduplicate and filter out already suppressed contacts
  const seenEmails = new Set<string>();
  const recipientsData: Array<{
    campaignId: string;
    contactId: string;
    email: string;
    name: string | null;
    customAttributes: string | null;
    status: string;
    skipReason: string | null;
  }> = [];

  let eligibleCount = 0;
  let skippedCount = 0;

  for (const c of contacts) {
    if (seenEmails.has(c.normalizedEmail)) continue;
    seenEmails.add(c.normalizedEmail);

    const suppression = await checkSuppression(c.normalizedEmail);
    if (suppression.isSuppressed) {
      recipientsData.push({
        campaignId,
        contactId: c.id,
        email: c.email,
        name: c.fullName || c.firstName || null,
        customAttributes: c.customAttributes,
        status: "skipped",
        skipReason: `Pre-suppressed: ${suppression.category} (${suppression.reason || "blocked"})`,
      });
      skippedCount++;
    } else {
      recipientsData.push({
        campaignId,
        contactId: c.id,
        email: c.email,
        name: c.fullName || c.firstName || null,
        customAttributes: c.customAttributes,
        status: "pending",
        skipReason: null,
      });
      eligibleCount++;
    }
  }

  // Clear any existing pending recipients for this campaign
  await prisma.campaignRecipient.deleteMany({
    where: { campaignId },
  });

  // Batch insert recipients
  // Insert in chunks of 500 for database compatibility
  const chunkSize = 500;
  for (let i = 0; i < recipientsData.length; i += chunkSize) {
    const chunk = recipientsData.slice(i, i + chunkSize);
    await prisma.campaignRecipient.createMany({
      data: chunk,
    });
  }

  // Update campaign metadata
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients: recipientsData.length,
      eligibleRecipients: eligibleCount,
      skippedCount,
      status: eligibleCount > 0 ? "queued" : "completed",
    },
  });

  return { total: recipientsData.length, eligible: eligibleCount, skipped: skippedCount };
}

/**
 * Process a batch of pending campaign recipients concurrently using pooled keep-alive SMTP connections
 */
export async function processCampaignBatch(
  campaignId: string,
  customBatchSize?: number
): Promise<{ processed: number; finished: boolean }> {
  lastWorkerPulse = new Date();
  activeCampaignId = campaignId;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.status === "paused" || campaign.status === "cancelled") {
    activeCampaignId = null;
    return { processed: 0, finished: true };
  }

  const sendRate = campaign.sendRate || 14;
  const batchSize = customBatchSize || sendRate;

  // Mark campaign status as 'sending' if it was 'queued'
  if (campaign.status === "queued") {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "sending", startedAt: campaign.startedAt || new Date() },
    });
  }

  // Fetch next batch of pending recipients
  const pendingRecipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "pending" },
    take: batchSize,
  });

  if (pendingRecipients.length === 0) {
    // Check if any recipients are still processing or pending
    const remainingCount = await prisma.campaignRecipient.count({
      where: { campaignId, status: { in: ["pending", "processing"] } },
    });

    if (remainingCount === 0) {
      // Mark campaign completed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "completed", completedAt: new Date() },
      });
      activeCampaignId = null;
      return { processed: 0, finished: true };
    }
    return { processed: 0, finished: false };
  }

  const settings = await prisma.applicationSettings.findUnique({ where: { id: "default" } });
  const baseUrl = settings?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";

  const batchStartTime = Date.now();

  // Process all recipients in this batch concurrently across the connection pool
  const results = await Promise.allSettled(
    pendingRecipients.map(async (recipient) => {
      // 1. Mandatory Pre-Send Suppression Re-Check
      const suppression = await checkSuppression(recipient.email);
      if (suppression.isSuppressed) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "skipped",
            skipReason: `Suppressed right before send: ${suppression.category}`,
          },
        });
        return { type: "skipped" };
      }

      // Mark as processing
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "processing" },
      });

      // 2. Personalize Subject & HTML
      const contactData = {
        email: recipient.email,
        name: recipient.name,
        customAttributes: recipient.customAttributes,
      };

      const personalizedSubject = renderPersonalizedString(campaign.subject, contactData);
      let personalizedHtml = renderPersonalizedString(campaign.htmlContent, contactData, { isHtml: true });

      // Inject Preheader if provided
      if (campaign.preheader) {
        const preheaderHtml = `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escape(
          campaign.preheader
        )}</div>`;
        personalizedHtml = preheaderHtml + personalizedHtml;
      }

      // 3. Create persistent EmailMessage record
      const emailMessage = await prisma.emailMessage.create({
        data: {
          campaignId,
          contactId: recipient.contactId,
          recipientEmail: recipient.email,
          fromEmail: campaign.fromEmail,
          subject: personalizedSubject,
          status: "pending",
        },
      });

      // 4. Inject Tracking Pixel and Tracked Links
      const { html: finalHtml, headers } = await prepareTrackedEmailContent({
        html: personalizedHtml,
        messageId: emailMessage.id,
        trackingId: emailMessage.trackingId,
        campaignId,
        recipientEmail: recipient.email,
        baseUrl,
        enableOpenTracking: campaign.trackOpens,
        enableClickTracking: campaign.trackClicks,
      });

      // 5. Transmit via AWS SES SMTP (utilizes connection pool)
      const sendResult = await sendMail({
        to: recipient.email,
        subject: personalizedSubject,
        html: finalHtml,
        text: campaign.plainTextContent ? renderPersonalizedString(campaign.plainTextContent, contactData) : undefined,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyTo: campaign.replyTo || undefined,
        headers,
      });

      // 6. Handle Outcomes
      if (sendResult.success) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "accepted",
            providerMessageId: sendResult.messageId || null,
            sentAt: new Date(),
          },
        });

        await prisma.emailMessage.update({
          where: { id: emailMessage.id },
          data: {
            status: "accepted",
            providerMessageId: sendResult.messageId || null,
            sentAt: new Date(),
          },
        });

        // Record send event
        await prisma.emailEvent.create({
          data: {
            messageId: emailMessage.id,
            campaignId,
            eventType: "send",
            providerMessageId: sendResult.messageId || null,
            payload: JSON.stringify({ response: sendResult.response }),
          },
        });

        return { type: "sent" };
      } else {
        // Failed send
        if (sendResult.isTransient && recipient.retryCount < 3) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "pending",
              retryCount: { increment: 1 },
              lastError: sendResult.error,
            },
          });
          return { type: "retry" };
        } else {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "failed",
              lastError: sendResult.error,
            },
          });

          await prisma.emailMessage.update({
            where: { id: emailMessage.id },
            data: {
              status: "failed",
            },
          });

          if (!sendResult.isTransient) {
            await suppressEmail({
              email: recipient.email,
              category: "hard_bounce",
              reason: `Immediate SMTP Permanent Error: ${sendResult.error}`,
              source: "smtp_response",
            });
          }

          return { type: "failed" };
        }
      }
    })
  );

  // Aggregate batch statistics and update Campaign counts atomically
  let sentIncrement = 0;
  let failedIncrement = 0;
  let skippedIncrement = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.type === "sent") sentIncrement++;
      else if (r.value.type === "failed") failedIncrement++;
      else if (r.value.type === "skipped") skippedIncrement++;
    }
  }

  const campaignUpdates: Record<string, unknown> = {};
  if (sentIncrement > 0) campaignUpdates.sentCount = { increment: sentIncrement };
  if (failedIncrement > 0) campaignUpdates.failedCount = { increment: failedIncrement };
  if (skippedIncrement > 0) campaignUpdates.skippedCount = { increment: skippedIncrement };

  if (Object.keys(campaignUpdates).length > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: campaignUpdates,
    });
  }

  // Smooth rate-pacing: Ensure batch does not exceed target rate per second
  const elapsedMs = Date.now() - batchStartTime;
  const targetBatchTimeMs = 1000;
  if (elapsedMs < targetBatchTimeMs && pendingRecipients.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, targetBatchTimeMs - elapsedMs));
  }

  return { processed: pendingRecipients.length, finished: false };
}

/**
 * Autonomous runner that loops until the campaign completes or is paused/cancelled
 */
export async function runCampaignWorker(campaignId: string) {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    let finished = false;
    while (!finished) {
      const res = await processCampaignBatch(campaignId);
      finished = res.finished;
      if (res.processed === 0 && !res.finished) {
        // Wait briefly before re-checking
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    isWorkerRunning = false;
    activeCampaignId = null;
  }
}
