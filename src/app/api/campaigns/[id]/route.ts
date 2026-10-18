import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
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
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
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
