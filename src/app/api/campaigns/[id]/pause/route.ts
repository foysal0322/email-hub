import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "paused" },
    });

    return NextResponse.json({ success: true, message: "Campaign paused" });
  } catch (error: unknown) {
    console.error("Campaign pause error:", error);
    return NextResponse.json({ error: "Failed to pause campaign" }, { status: 500 });
  }
}
