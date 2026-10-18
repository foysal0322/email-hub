import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { suppressEmail, unsuppressEmail } from "@/lib/suppression";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { reason: { contains: search } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [entries, total] = await Promise.all([
      prisma.suppressionEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.suppressionEntry.count({ where }),
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Suppression GET error:", error);
    return NextResponse.json({ error: "Failed to fetch suppression entries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const { email, category, reason } = await req.json();

    if (!email || !category || !reason) {
      return NextResponse.json(
        { error: "Email, category, and reason are required" },
        { status: 400 }
      );
    }

    const entry = await suppressEmail({
      email,
      category,
      reason,
      source: "admin_manual",
      createdBy: session?.email || "admin",
    });

    if (session) {
      await prisma.auditLog.create({
        data: {
          userId: session.id,
          action: "suppress_recipient_manual",
          resourceType: "suppression",
          resourceId: entry?.id,
          details: JSON.stringify({ email, category, reason }),
        },
      });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: unknown) {
    console.error("Suppression POST error:", error);
    return NextResponse.json({ error: "Failed to add suppression entry" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const reason = url.searchParams.get("reason") || "Administrative review";
    const forceOverride = url.searchParams.get("forceOverride") === "true";

    if (!id) {
      return NextResponse.json({ error: "Suppression entry ID is required" }, { status: 400 });
    }

    const result = await unsuppressEmail({
      id,
      adminUserId: session?.id || "admin",
      reason,
      forceOverride,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Suppression DELETE error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
