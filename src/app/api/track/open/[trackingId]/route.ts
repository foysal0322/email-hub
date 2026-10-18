import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 1x1 transparent 43-byte GIF binary
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: Request, { params }: { params: { trackingId: string } }) {
  try {
    const trackingId = params.trackingId;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    if (trackingId) {
      // Find message
      const message = await prisma.emailMessage.findUnique({
        where: { trackingId },
      });

      if (message) {
        const isFirstOpen = !message.openedAt;

        // Update message
        await prisma.emailMessage.update({
          where: { id: message.id },
          data: {
            openedAt: message.openedAt || new Date(),
            openCount: { increment: 1 },
          },
        });

        // Record open event
        await prisma.emailEvent.create({
          data: {
            messageId: message.id,
            campaignId: message.campaignId,
            eventType: "open",
            providerMessageId: message.providerMessageId,
            ipAddress: ip,
            userAgent,
          },
        });

        // If part of campaign, increment campaign counters
        if (message.campaignId) {
          await prisma.campaign.update({
            where: { id: message.campaignId },
            data: {
              totalOpensCount: { increment: 1 },
              ...(isFirstOpen ? { uniqueOpensCount: { increment: 1 } } : {}),
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Open tracking error:", error);
  }

  // Always return the transparent GIF with aggressive anti-cache headers
  return new Response(TRANSPARENT_GIF_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF_BUFFER.length),
      "Cache-Control": "no-cache, no-store, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
