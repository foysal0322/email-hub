import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!params.id || params.id === "create" || params.id === "new") {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const [campaign, statusCountsRaw, openedCount, clickedCount] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: params.id },
        include: {
          template: true,
          _count: {
            select: {
              recipients: true,
              messages: true,
              events: true,
              links: true,
            },
          },
        },
      }),
      prisma.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaignId: params.id },
        _count: { status: true },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId: params.id, openedAt: { not: null } },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId: params.id, clickedAt: { not: null } },
      }),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      accepted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      bounced: 0,
    };

    let realTotal = 0;
    for (const item of statusCountsRaw) {
      counts[item.status] = item._count.status;
      realTotal += item._count.status;
    }

    const sentCount = (counts.accepted || 0) + (counts.delivered || 0);
    const skippedCount = counts.skipped || 0;
    const failedCount = counts.failed || 0;
    const bouncedCount = counts.bounced || 0;
    const pendingCount = (counts.pending || 0) + (counts.processing || 0);

    // If campaign in DB has desynchronized counts, auto-sync it silently
    if (
      campaign.totalRecipients !== realTotal ||
      campaign.sentCount !== sentCount ||
      campaign.skippedCount !== skippedCount ||
      campaign.failedCount !== failedCount ||
      campaign.uniqueOpensCount !== openedCount ||
      campaign.uniqueClicksCount !== clickedCount
    ) {
      await prisma.campaign
        .update({
          where: { id: params.id },
          data: {
            totalRecipients: realTotal,
            sentCount,
            skippedCount,
            failedCount,
            uniqueOpensCount: openedCount,
            uniqueClicksCount: clickedCount,
          },
        })
        .catch(() => {});
    }

    const campaignWithLiveCounts = {
      ...campaign,
      totalRecipients: realTotal || campaign.totalRecipients,
      sentCount,
      deliveredCount: counts.delivered || 0,
      skippedCount,
      failedCount,
      bouncedCount,
      pendingCount,
      uniqueOpensCount: openedCount,
      uniqueClicksCount: clickedCount,
      countsByStatus: counts,
    };

    return NextResponse.json({ campaign: campaignWithLiveCounts });
  } catch (error: unknown) {
    console.error("Campaign GET by ID error:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description,
        subject: data.subject,
        preheader: data.preheader,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        replyTo: data.replyTo,
        htmlContent: data.htmlContent,
        plainTextContent: data.plainTextContent,
        templateId: data.templateId || null,
        contactListId: data.contactListId !== undefined ? data.contactListId : undefined,
        sendRate: data.sendRate ? Number(data.sendRate) : undefined,
        trackOpens: data.trackOpens !== undefined ? Boolean(data.trackOpens) : undefined,
        trackClicks: data.trackClicks !== undefined ? Boolean(data.trackClicks) : undefined,
        status: data.status,
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    console.error("Campaign PUT error:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Campaign DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
