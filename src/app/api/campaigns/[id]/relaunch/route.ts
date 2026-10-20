import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { prepareCampaignAudience, runCampaignWorker } from "@/lib/queue";

async function getUniqueRelaunchName(baseName: string): Promise<string> {
  const cleanBase = baseName.replace(/\s*\(Relaunch(?:\s+\d+)?\)$/i, "").trim();

  const existing = await prisma.campaign.findMany({
    where: {
      name: {
        startsWith: cleanBase,
      },
    },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  const candidate1 = `${cleanBase} (Relaunch)`;
  if (!existingNames.has(candidate1.toLowerCase())) {
    return candidate1;
  }

  let counter = 2;
  while (existingNames.has(`${cleanBase} (Relaunch ${counter})`.toLowerCase())) {
    counter++;
  }
  return `${cleanBase} (Relaunch ${counter})`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Source campaign not found" }, { status: 404 });
    }

    let body: { name?: string; autoStart?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const newName = body.name?.trim() || (await getUniqueRelaunchName(campaign.name));
    const autoStart = body.autoStart !== false;

    // 1. Create duplicate campaign preserving configuration and content
    const newCampaign = await prisma.campaign.create({
      data: {
        name: newName,
        description: campaign.description,
        subject: campaign.subject,
        preheader: campaign.preheader,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyTo: campaign.replyTo,
        htmlContent: campaign.htmlContent,
        plainTextContent: campaign.plainTextContent,
        templateId: campaign.templateId,
        contactListId: campaign.contactListId,
        sendRate: campaign.sendRate,
        trackOpens: campaign.trackOpens,
        trackClicks: campaign.trackClicks,
        status: "draft",
      },
    });

    let audienceSummary = null;

    // 2. If autoStart is requested (default for Re-launch), freeze audience snapshot & launch worker
    if (autoStart) {
      audienceSummary = await prepareCampaignAudience(newCampaign.id, {
        sourceCampaignId: campaign.id,
      });

      runCampaignWorker(newCampaign.id).catch((err) => {
        console.error("Relaunch worker background error:", err);
      });
    }

    return NextResponse.json({
      success: true,
      message: autoStart
        ? `Campaign re-launched as "${newCampaign.name}" and sending started.`
        : `Campaign duplicated as draft "${newCampaign.name}".`,
      campaign: newCampaign,
      audienceSummary,
    });
  } catch (error: unknown) {
    console.error("Campaign relaunch error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to re-launch campaign" },
      { status: 500 }
    );
  }
}
