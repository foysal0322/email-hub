import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleBounceEvent, handleComplaintEvent } from "@/lib/suppression";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Handle Amazon SNS Subscription Confirmation
    if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
      console.log("Received Amazon SNS SubscriptionConfirmation, confirming URL:", body.SubscribeURL);
      try {
        await fetch(body.SubscribeURL);
        return NextResponse.json({ success: true, message: "Subscription confirmed" });
      } catch (e) {
        console.error("Failed to fetch SubscribeURL:", e);
        return NextResponse.json({ error: "Failed to confirm subscription" }, { status: 500 });
      }
    }

    // Unwrap SNS Notification message if wrapped
    let messageData: Record<string, unknown> = body;
    if (body.Type === "Notification" && typeof body.Message === "string") {
      try {
        messageData = JSON.parse(body.Message);
      } catch {
        // Raw message
      }
    }

    const eventType = (messageData.eventType || messageData.notificationType || "") as string;
    const mail = (messageData.mail || {}) as Record<string, unknown>;
    const providerMessageId = (mail.messageId || "") as string;

    // Find corresponding message in our database if exists
    let dbMessage = null;
    if (providerMessageId) {
      dbMessage = await prisma.emailMessage.findFirst({
        where: { providerMessageId },
      });
    }

    // 1. Process Bounce
    if (eventType.toLowerCase() === "bounce") {
      const bounce = (messageData.bounce || {}) as Record<string, unknown>;
      const bounceType = (bounce.bounceType || "Permanent") as "Permanent" | "Transient" | "Undetermined";
      const bounceSubType = (bounce.bounceSubType || "") as string;
      const bouncedRecipients = (bounce.bouncedRecipients || []) as Array<{
        emailAddress: string;
        diagnosticCode?: string;
      }>;

      for (const rec of bouncedRecipients) {
        await handleBounceEvent({
          email: rec.emailAddress,
          bounceType,
          subType: bounceSubType,
          diagnosticCode: rec.diagnosticCode,
          providerMessageId,
        });

        // Record bounce in message and recipient
        if (dbMessage) {
          await prisma.emailMessage.update({
            where: { id: dbMessage.id },
            data: { status: "bounced" },
          });

          if (dbMessage.campaignId) {
            await prisma.campaign.update({
              where: { id: dbMessage.campaignId },
              data: { bouncedCount: { increment: 1 } },
            });

            await prisma.campaignRecipient.updateMany({
              where: { campaignId: dbMessage.campaignId, email: rec.emailAddress },
              data: { status: "bounced", lastError: rec.diagnosticCode || `SES Bounce: ${bounceType}` },
            });
          }
        }
      }
    }

    // 2. Process Complaint
    else if (eventType.toLowerCase() === "complaint") {
      const complaint = (messageData.complaint || {}) as Record<string, unknown>;
      const complainedRecipients = (complaint.complainedRecipients || []) as Array<{
        emailAddress: string;
      }>;
      const feedbackType = (complaint.complaintFeedbackType || "abuse") as string;

      for (const rec of complainedRecipients) {
        await handleComplaintEvent({
          email: rec.emailAddress,
          complaintFeedbackType: feedbackType,
          providerMessageId,
        });

        if (dbMessage) {
          await prisma.emailMessage.update({
            where: { id: dbMessage.id },
            data: { status: "complained" },
          });

          if (dbMessage.campaignId) {
            await prisma.campaign.update({
              where: { id: dbMessage.campaignId },
              data: { complaintCount: { increment: 1 } },
            });

            await prisma.campaignRecipient.updateMany({
              where: { campaignId: dbMessage.campaignId, email: rec.emailAddress },
              data: { status: "complained" },
            });
          }
        }
      }
    }

    // 3. Process Delivery
    else if (eventType.toLowerCase() === "delivery") {
      if (dbMessage) {
        await prisma.emailMessage.update({
          where: { id: dbMessage.id },
          data: { status: "delivered", deliveredAt: new Date() },
        });

        if (dbMessage.campaignId) {
          await prisma.campaign.update({
            where: { id: dbMessage.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });

          await prisma.campaignRecipient.updateMany({
            where: { campaignId: dbMessage.campaignId, email: dbMessage.recipientEmail },
            data: { status: "delivered", deliveredAt: new Date() },
          });
        }
      }
    }

    // Log the event record
    await prisma.emailEvent.create({
      data: {
        messageId: dbMessage?.id || null,
        campaignId: dbMessage?.campaignId || null,
        eventType: eventType.toLowerCase() || "unknown",
        providerMessageId,
        payload: rawBody.slice(0, 5000), // Protect against excessive payload sizes
      },
    });

    return NextResponse.json({ success: true, processedType: eventType });
  } catch (error: unknown) {
    console.error("SES Webhook processing error:", error);
    return NextResponse.json({ error: "Failed to process webhook event" }, { status: 500 });
  }
}
