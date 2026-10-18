import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { prepareCampaignAudience, runCampaignWorker } from "@/lib/queue";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "sending") {
      return NextResponse.json({ error: "Campaign is already running" }, { status: 400 });
    }

    // 1. Freeze audience snapshot into CampaignRecipient table
    const audienceSummary = await prepareCampaignAudience(params.id);

    // 2. Launch background sending process asynchronously
    // Do not block HTTP response
    runCampaignWorker(params.id).catch((err) => {
      console.error("Worker background error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Campaign queued and worker dispatched",
      audienceSummary,
    });
  } catch (error: unknown) {
    console.error("Campaign start error:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to start campaign" }, { status: 500 });
  }
}
