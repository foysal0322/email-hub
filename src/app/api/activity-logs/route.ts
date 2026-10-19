import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10));
    const skip = (page - 1) * limit;

    const [auditLogs, totalAudit, emailEvents, totalEvents] = await Promise.all([
      tab === "events"
        ? []
        : prisma.auditLog.findMany({
            skip: tab === "audit" ? skip : 0,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { email: true, name: true } } },
          }),
      prisma.auditLog.count(),
      tab === "audit"
        ? []
        : prisma.emailEvent.findMany({
            skip: tab === "events" ? skip : 0,
            take: limit,
            orderBy: { timestamp: "desc" },
            include: {
              campaign: { select: { name: true } },
              message: { select: { recipientEmail: true, subject: true } },
            },
          }),
      prisma.emailEvent.count(),
    ]);

    return NextResponse.json({
      auditLogs,
      emailEvents,
      pagination: {
        page,
        limit,
        totalEvents,
        totalEventsPages: Math.ceil(totalEvents / limit) || 1,
        totalAudit,
        totalAuditPages: Math.ceil(totalAudit / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("Activity logs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
