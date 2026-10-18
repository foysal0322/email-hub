import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { linkId: string } }) {
  const linkId = params.linkId;
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  try {
    const link = await prisma.emailLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const isFirstClick = !link.firstClickedAt;

    // Update link
    await prisma.emailLink.update({
      where: { id: link.id },
      data: {
        firstClickedAt: link.firstClickedAt || new Date(),
        lastClickedAt: new Date(),
        clickCount: { increment: 1 },
      },
    });

    // Update message click state
    if (link.messageId) {
      await prisma.emailMessage.update({
        where: { id: link.messageId },
        data: {
          clickedAt: new Date(),
          clickCount: { increment: 1 },
        },
      });
    }

    // Log click event
    await prisma.emailEvent.create({
      data: {
        messageId: link.messageId,
        campaignId: link.campaignId,
        linkId: link.id,
        eventType: "click",
        ipAddress: ip,
        userAgent,
      },
    });

    // Increment campaign click counters
    if (link.campaignId) {
      await prisma.campaign.update({
        where: { id: link.campaignId },
        data: {
          totalClicksCount: { increment: 1 },
          ...(isFirstClick ? { uniqueClicksCount: { increment: 1 } } : {}),
        },
      });
    }

    // Security check: validate that destination is a valid http/https URL
    const target = link.targetUrl;
    if (target.startsWith("http://") || target.startsWith("https://")) {
      return NextResponse.redirect(target, { status: 302 });
    }

    return NextResponse.redirect(new URL("/", req.url));
  } catch (error) {
    console.error("Click tracking error:", error);
    return NextResponse.redirect(new URL("/", req.url));
  }
}
