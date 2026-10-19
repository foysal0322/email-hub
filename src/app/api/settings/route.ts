import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.applicationSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    // Mask password before returning to client
    const masked = {
      ...settings,
      smtpPassword: settings.smtpPassword ? "••••••••••••••••" : "",
    };

    return NextResponse.json({ settings: masked });
  } catch (error: unknown) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const updateData: Record<string, unknown> = {
      smtpHost: data.smtpHost,
      smtpPort: Number(data.smtpPort) || 587,
      smtpUsername: data.smtpUsername,
      smtpRegion: data.smtpRegion || "us-east-1",
      defaultFromName: data.defaultFromName,
      defaultFromEmail: data.defaultFromEmail,
      defaultReplyTo: data.defaultReplyTo || null,
      appBaseUrl: data.appBaseUrl || "http://localhost:3000",
      maxSendRate: Number(data.maxSendRate) || 14,
      maxSoftBounces: Number(data.maxSoftBounces) || 3,
      trackOpens: Boolean(data.trackOpens),
      trackClicks: Boolean(data.trackClicks),
    };

    // Only update password if a new one was provided (not masked)
    if (data.smtpPassword && !data.smtpPassword.includes("••••")) {
      updateData.smtpPassword = data.smtpPassword;
    }

    const updated = await prisma.applicationSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        smtpHost: data.smtpHost || "",
        smtpPort: Number(data.smtpPort) || 587,
        smtpUsername: data.smtpUsername || "",
        smtpPassword: data.smtpPassword || "",
        smtpRegion: data.smtpRegion || "us-east-1",
        defaultFromName: data.defaultFromName || "EmailHub Admin",
        defaultFromEmail: data.defaultFromEmail || "notifications@example.com",
        defaultReplyTo: data.defaultReplyTo || null,
        appBaseUrl: data.appBaseUrl || "http://localhost:3000",
        maxSendRate: Number(data.maxSendRate) || 14,
        maxSoftBounces: Number(data.maxSoftBounces) || 3,
        trackOpens: Boolean(data.trackOpens),
        trackClicks: Boolean(data.trackClicks),
      },
      update: updateData,
    });

    const { closeSmtpPool } = await import("@/lib/smtp");
    closeSmtpPool();

    return NextResponse.json({ success: true, settings: { ...updated, smtpPassword: "••••••••" } });
  } catch (error: unknown) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
