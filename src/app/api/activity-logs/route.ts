import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const [auditLogs, emailEvents] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.emailEvent.findMany({
        take: limit,
        orderBy: { timestamp: "desc" },
        include: {
          campaign: { select: { name: true } },
          message: { select: { recipientEmail: true, subject: true } },
        },
      }),
    ]);

    return NextResponse.json({ auditLogs, emailEvents });
  } catch (error: unknown) {
    console.error("Activity logs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
