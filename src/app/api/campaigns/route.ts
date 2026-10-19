import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search };

    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const isPaginated = pageParam !== null || limitParam !== null;

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const limit = Math.max(1, parseInt(limitParam || "20", 10));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip: isPaginated ? skip : undefined,
        take: isPaginated ? limit : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          template: { select: { id: true, name: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("Campaigns GET error:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      name,
      description,
      subject,
      preheader,
      fromName,
      fromEmail,
      replyTo,
      htmlContent,
      plainTextContent,
      templateId,
      contactListId,
      sendRate = 14,
      trackOpens = true,
      trackClicks = true,
    } = data;

    if (!name || !subject || !fromEmail || !htmlContent) {
      return NextResponse.json(
        { error: "Campaign name, subject, fromEmail, and content are required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        subject: subject.trim(),
        preheader: preheader?.trim() || null,
        fromName: fromName?.trim() || "EmailHub Admin",
        fromEmail: fromEmail.trim(),
        replyTo: replyTo?.trim() || null,
        htmlContent,
        plainTextContent: plainTextContent || null,
        templateId: templateId || null,
        contactListId: contactListId || null,
        sendRate: Number(sendRate) || 14,
        trackOpens: Boolean(trackOpens),
        trackClicks: Boolean(trackClicks),
        status: "draft",
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    console.error("Campaign POST error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
