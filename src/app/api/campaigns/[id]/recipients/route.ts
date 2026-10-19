import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      campaignId: params.id,
    };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { skipReason: { contains: search } },
        { lastError: { contains: search } },
      ];
    }

    const [recipients, total, statusGroups] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
      }),
      prisma.campaignRecipient.count({ where }),
      prisma.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaignId: params.id },
        _count: { status: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      all: 0,
      pending: 0,
      processing: 0,
      accepted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      bounced: 0,
    };

    for (const group of statusGroups) {
      statusCounts[group.status] = group._count.status;
      statusCounts.all += group._count.status;
    }

    return NextResponse.json({
      recipients,
      statusCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("Campaign recipients GET error:", error);
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
  }
}
