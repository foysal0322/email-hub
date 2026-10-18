import { NextResponse } from "next/server";
import { verifySmtpConnection, SmtpConfig } from "@/lib/smtp";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    let customConfig: SmtpConfig | undefined;
    if (body.host && body.username) {
      // If client sent password with bullets, fetch existing DB password
      let pass = body.password;
      if (!pass || pass.includes("••••")) {
        const current = await prisma.applicationSettings.findUnique({ where: { id: "default" } });
        pass = current?.smtpPassword || process.env.AWS_SES_SMTP_PASSWORD;
      }

      customConfig = {
        host: body.host,
        port: Number(body.port) || 587,
        username: body.username,
        password: pass,
        fromName: body.fromName || "Test Sender",
        fromEmail: body.fromEmail || "test@example.com",
      };
    }

    const result = await verifySmtpConnection(customConfig);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    console.error("SMTP test error:", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || "SMTP verification failed" },
      { status: 500 }
    );
  }
}
