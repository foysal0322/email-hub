import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getWorkerStatus } from "@/lib/queue";
import { getActiveSmtpConfig } from "@/lib/smtp";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "ok";
  let dbError = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: unknown) {
    dbStatus = "error";
    dbError = (err as Error).message;
  }

  const smtpConfig = await getActiveSmtpConfig();
  const workerStatus = getWorkerStatus();

  const isHealthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      latencyMs: Date.now() - startTime,
      database: {
        status: dbStatus,
        error: dbError,
      },
      smtp: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        configured: Boolean(smtpConfig.host && smtpConfig.username),
      },
      queue: workerStatus,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
