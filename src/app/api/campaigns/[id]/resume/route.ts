import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runCampaignWorker } from "@/lib/queue";

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
      data: { status: "sending" },
    });

    // Re-dispatch background worker
    runCampaignWorker(params.id).catch(console.error);

    return NextResponse.json({ success: true, message: "Campaign resumed" });
  } catch (error: unknown) {
    console.error("Campaign resume error:", error);
    return NextResponse.json({ error: "Failed to resume campaign" }, { status: 500 });
  }
}
