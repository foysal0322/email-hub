import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkSuppression, suppressEmail } from "@/lib/suppression";
import { renderPersonalizedString } from "@/lib/personalization";
import { prepareTrackedEmailContent } from "@/lib/tracking";
import { sendMail } from "@/lib/smtp";

export async function GET() {
  try {
    const history = await prisma.emailMessage.findMany({
      where: { campaignId: null },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        status: true,
        providerMessageId: true,
        sentAt: true,
        openedAt: true,
        openCount: true,
        clickedAt: true,
        clickCount: true,
      },
    });

    return NextResponse.json({ history });
  } catch (error: unknown) {
    console.error("Single email history GET error:", error);
    return NextResponse.json({ error: "Failed to fetch single send history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      to,
      subject,
      htmlContent,
      plainTextContent,
      fromName,
      fromEmail,
      replyTo,
      contactId,
      isTestSend = false,
      trackOpens = true,
      trackClicks = true,
    } = data;

    if (!to || !subject || !htmlContent) {
      return NextResponse.json({ error: "Recipient email, subject, and message are required" }, { status: 400 });
    }

    // 1. Mandatory Pre-Send Suppression Guard (Even single sends must NOT bypass suppression!)
    if (!isTestSend) {
      const suppression = await checkSuppression(to);
      if (suppression.isSuppressed) {
        return NextResponse.json(
          {
            error: `Recipient is blocked in the global suppression registry (${suppression.category}): ${suppression.reason}`,
            suppressed: true,
            category: suppression.category,
          },
          { status: 403 }
        );
      }
    }

    // 2. Lookup contact if ID or lookup is present for personalization
    let contactData = { email: to, name: "" };
    if (contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (contact) {
        contactData = {
          ...contact,
          name: contact.fullName || contact.firstName || "",
          email: contact.email,
        };
      }
    }

    const personalizedSubject = renderPersonalizedString(subject, contactData);
    const personalizedHtml = renderPersonalizedString(htmlContent, contactData, { isHtml: true });

    // 3. Create persistent EmailMessage record
    const emailMessage = await prisma.emailMessage.create({
      data: {
        campaignId: null,
        contactId: contactId || null,
        recipientEmail: to.trim().toLowerCase(),
        fromEmail: fromEmail || "notifications@example.com",
        subject: personalizedSubject,
        status: "pending",
      },
    });

    // 4. Tracking and unsubscribe headers
    const settings = await prisma.applicationSettings.findUnique({ where: { id: "default" } });
    const baseUrl = settings?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";

    const { html: finalHtml, headers } = await prepareTrackedEmailContent({
      html: personalizedHtml,
      messageId: emailMessage.id,
      trackingId: emailMessage.trackingId,
      recipientEmail: to,
      baseUrl,
      enableOpenTracking: trackOpens,
      enableClickTracking: trackClicks,
    });

    // 5. Transmit via AWS SES SMTP
    const sendResult = await sendMail({
      to: to.trim(),
      subject: personalizedSubject,
      html: finalHtml,
      text: plainTextContent ? renderPersonalizedString(plainTextContent, contactData) : undefined,
      fromName,
      fromEmail,
      replyTo,
      headers,
    });

    if (sendResult.success) {
      await prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          status: "accepted",
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date(),
        },
      });

      await prisma.emailEvent.create({
        data: {
          messageId: emailMessage.id,
          eventType: "send",
          providerMessageId: sendResult.messageId || null,
          payload: JSON.stringify({ response: sendResult.response }),
        },
      });

      return NextResponse.json({
        success: true,
        messageId: sendResult.messageId,
        recordId: emailMessage.id,
        response: sendResult.response,
      });
    } else {
      await prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          status: "failed",
        },
      });

      if (!sendResult.isTransient) {
        await suppressEmail({
          email: to,
          category: "hard_bounce",
          reason: `Single send permanent failure: ${sendResult.error}`,
          source: "smtp_response",
        });
      }

      return NextResponse.json(
        {
          error: sendResult.error,
          code: sendResult.errorCode,
          isTransient: sendResult.isTransient,
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    console.error("Single email send error:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to send email" }, { status: 500 });
  }
}
