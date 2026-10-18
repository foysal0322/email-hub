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
export async function prepareCampaignAudience(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new Error("Campaign not found");

  // Fetch all subscribed contacts (or list members if specified)
  const contacts = await prisma.contact.findMany({
    where: { status: "subscribed" },
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
 * Process a batch of pending campaign recipients with strict rate limiting & suppression checking
 */
export async function processCampaignBatch(campaignId: string, batchSize = 10): Promise<{ processed: number; finished: boolean }> {
  lastWorkerPulse = new Date();
  activeCampaignId = campaignId;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.status === "paused" || campaign.status === "cancelled") {
    activeCampaignId = null;
    return { processed: 0, finished: true };
  }

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

  for (const recipient of pendingRecipients) {
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
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { skippedCount: { increment: 1 } },
      });
      continue;
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

    // 5. Transmit via AWS SES SMTP
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

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });
    } else {
      // Failed send
      if (sendResult.isTransient && recipient.retryCount < 3) {
        // Transient error -> retry
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "pending",
            retryCount: { increment: 1 },
            lastError: sendResult.error,
          },
        });
      } else {
        // Permanent failure
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

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });

        // Automatically suppress if 5xx hard bounce
        if (!sendResult.isTransient) {
          await suppressEmail({
            email: recipient.email,
            category: "hard_bounce",
            reason: `Immediate SMTP Permanent Error: ${sendResult.error}`,
            source: "smtp_response",
          });
        }
      }
    }

    // Rate-limiting delay (e.g. 1000ms / 14 ~ 70ms between dispatches)
    const delayMs = Math.max(20, Math.floor(1000 / (campaign.sendRate || 14)));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
      const res = await processCampaignBatch(campaignId, 10);
      finished = res.finished;
      if (res.processed === 0 && !res.finished) {
        // Wait a second before re-checking
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } finally {
    isWorkerRunning = false;
    activeCampaignId = null;
  }
}
