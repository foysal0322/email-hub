import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");
    const daysParam = parseInt(url.searchParams.get("days") || "30", 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysParam);

    // 1. Core aggregates
    const campaignFilter = campaignId ? { campaignId } : {};

    const [
      totalAttempted,
      totalAccepted,
      totalDelivered,
      totalFailed,
      totalSkipped,
      hardBounces,
      softBounces,
      complaints,
      totalSuppressed,
      uniqueOpens,
      totalOpens,
      uniqueClicks,
      totalClicks,
      unsubscribed,
      recentCampaigns,
      recentErrors,
      topLinks,
    ] = await Promise.all([
      // Total attempted = accepted + failed + delivered + bounced
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          createdAt: { gte: startDate },
        },
      }),
      // Accepted by provider
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          status: { in: ["accepted", "delivered"] },
          createdAt: { gte: startDate },
        },
      }),
      // Delivered (via delivery event or confirmed)
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          OR: [{ status: "delivered" }, { deliveredAt: { not: null } }],
          createdAt: { gte: startDate },
        },
      }),
      // Failed
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          status: "failed",
          createdAt: { gte: startDate },
        },
      }),
      // Skipped
      prisma.campaignRecipient.count({
        where: {
          ...campaignFilter,
          status: "skipped",
          createdAt: { gte: startDate },
        },
      }),
      // Hard Bounces
      prisma.suppressionEntry.count({
        where: { category: "hard_bounce" },
      }),
      // Soft Bounces
      prisma.suppressionEntry.count({
        where: { category: "soft_bounce" },
      }),
      // Complaints
      prisma.suppressionEntry.count({
        where: { category: "complaint" },
      }),
      // Total Suppressed
      prisma.suppressionEntry.count(),
      // Unique opens
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          openedAt: { not: null },
          createdAt: { gte: startDate },
        },
      }),
      // Total opens
      prisma.emailEvent.count({
        where: {
          ...campaignFilter,
          eventType: "open",
          timestamp: { gte: startDate },
        },
      }),
      // Unique clicks
      prisma.emailMessage.count({
        where: {
          ...campaignFilter,
          clickedAt: { not: null },
          createdAt: { gte: startDate },
        },
      }),
      // Total clicks
      prisma.emailEvent.count({
        where: {
          ...campaignFilter,
          eventType: "click",
          timestamp: { gte: startDate },
        },
      }),
      // Unsubscribes
      prisma.suppressionEntry.count({
        where: { category: "unsubscribe", createdAt: { gte: startDate } },
      }),
      // Recent campaigns
      prisma.campaign.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          sentCount: true,
          deliveredCount: true,
          uniqueOpensCount: true,
          uniqueClicksCount: true,
          bouncedCount: true,
          createdAt: true,
        },
      }),
      // Recent errors from campaign recipients
      prisma.campaignRecipient.findMany({
        where: {
          lastError: { not: null },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          status: true,
          lastError: true,
          skipReason: true,
          createdAt: true,
          campaign: { select: { name: true } },
        },
      }),
      // Top performing links
      prisma.emailLink.findMany({
        where: campaignFilter,
        take: 5,
        orderBy: { clickCount: "desc" },
        select: {
          id: true,
          targetUrl: true,
          clickCount: true,
          firstClickedAt: true,
          lastClickedAt: true,
        },
      }),
    ]);

    // Distinct delivery baseline
    const deliveredCount = totalDelivered > 0 ? totalDelivered : totalAccepted;
    const totalBounces = hardBounces + softBounces;

    // Computed rates with safe zero denominator protection
    const deliveryRate = totalAttempted > 0 ? (deliveredCount / totalAttempted) * 100 : 0;
    const bounceRate = totalAttempted > 0 ? (totalBounces / totalAttempted) * 100 : 0;
    const openRate = deliveredCount > 0 ? (uniqueOpens / deliveredCount) * 100 : 0;
    const ctr = deliveredCount > 0 ? (uniqueClicks / deliveredCount) * 100 : 0;
    const ctor = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) * 100 : 0;
    const unsubscribeRate = deliveredCount > 0 ? (unsubscribed / deliveredCount) * 100 : 0;

    // Timeline chart data (Last 14 days)
    const timelineData: Array<{
      date: string;
      sent: number;
      delivered: number;
      opens: number;
      clicks: number;
      bounces: number;
    }> = [];

    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dateLabel = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const [sentDay, opensDay, clicksDay] = await Promise.all([
        prisma.emailMessage.count({
          where: {
            createdAt: { gte: dayStart, lte: dayEnd },
            status: { in: ["accepted", "delivered"] },
          },
        }),
        prisma.emailEvent.count({
          where: {
            eventType: "open",
            timestamp: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.emailEvent.count({
          where: {
            eventType: "click",
            timestamp: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      timelineData.push({
        date: dateLabel,
        sent: sentDay,
        delivered: sentDay,
        opens: opensDay,
        clicks: clicksDay,
        bounces: 0,
      });
    }

    return NextResponse.json({
      kpis: {
        totalAttempted,
        totalAccepted,
        totalDelivered: deliveredCount,
        totalFailed,
        totalSkipped,
        hardBounces,
        softBounces,
        totalBounces,
        complaints,
        totalSuppressed,
        uniqueOpens,
        totalOpens,
        uniqueClicks,
        totalClicks,
        deliveryRate: Number(deliveryRate.toFixed(2)),
        bounceRate: Number(bounceRate.toFixed(2)),
        openRate: Number(openRate.toFixed(2)),
        ctr: Number(ctr.toFixed(2)),
        ctor: Number(ctor.toFixed(2)),
        unsubscribeRate: Number(unsubscribeRate.toFixed(2)),
      },
      timeline: timelineData,
      recentCampaigns,
      recentErrors,
      topLinks,
    });
  } catch (error: unknown) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to compute dashboard metrics" }, { status: 500 });
  }
}
