import nodemailer from "nodemailer";
import prisma from "./prisma";

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
}

export async function getActiveSmtpConfig(): Promise<SmtpConfig> {
  const dbSettings = await prisma.applicationSettings.findUnique({
    where: { id: "default" },
  });

  return {
    host: dbSettings?.smtpHost || process.env.AWS_SES_SMTP_HOST || "ujz58nc6cr4g.fips.yxbq.mail-manager-smtp.amazonaws.com",
    port: dbSettings?.smtpPort || Number(process.env.AWS_SES_SMTP_PORT) || 587,
    username: dbSettings?.smtpUsername || process.env.AWS_SES_SMTP_USERNAME || "inp-awalp2xcurrgakrl2uj6mtha",
    password: dbSettings?.smtpPassword || process.env.AWS_SES_SMTP_PASSWORD || "Nsu01_Sm1P_2026",
    fromName: dbSettings?.defaultFromName || process.env.EMAIL_FROM_NAME || "EmailHub Admin",
    fromEmail: dbSettings?.defaultFromEmail || process.env.EMAIL_FROM_ADDRESS || "notifications@example.com",
    replyTo: dbSettings?.defaultReplyTo || process.env.EMAIL_REPLY_TO || undefined,
  };
}

export interface SmtpPoolOptions {
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  rateLimit?: number;
  rateDelta?: number;
}

export function createSmtpTransporter(config: SmtpConfig, poolOptions?: SmtpPoolOptions) {
  const transportOptions: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    secure: false, // port 587 uses STARTTLS
    requireTLS: true,
    auth: {
      user: config.username,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: true, // Strictly verify SSL/TLS certificates
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };

  if (poolOptions?.pool) {
    transportOptions.pool = true;
    transportOptions.maxConnections = poolOptions.maxConnections ?? 5;
    transportOptions.maxMessages = poolOptions.maxMessages ?? 100;
    if (poolOptions.rateLimit) {
      transportOptions.rateLimit = poolOptions.rateLimit;
      transportOptions.rateDelta = poolOptions.rateDelta ?? 1000;
    }
  }

  return nodemailer.createTransport(transportOptions as nodemailer.TransportOptions);
}

// Global cached connection pool for high-performance reuse
let cachedPoolTransporter: nodemailer.Transporter | null = null;
let cachedPoolKey = "";

export function getPooledTransporter(config: SmtpConfig, maxRate = 14): nodemailer.Transporter {
  const key = `${config.host}:${config.port}:${config.username}:${config.password}:${maxRate}`;
  if (!cachedPoolTransporter || cachedPoolKey !== key) {
    if (cachedPoolTransporter) {
      try {
        cachedPoolTransporter.close();
      } catch {}
    }
    cachedPoolTransporter = createSmtpTransporter(config, {
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: maxRate,
      rateDelta: 1000,
    });
    cachedPoolKey = key;
  }
  return cachedPoolTransporter;
}

export function closeSmtpPool(): void {
  if (cachedPoolTransporter) {
    try {
      cachedPoolTransporter.close();
    } catch {}
    cachedPoolTransporter = null;
    cachedPoolKey = "";
  }
}

export interface SmtpDiagnosticResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export async function verifySmtpConnection(customConfig?: SmtpConfig): Promise<SmtpDiagnosticResult> {
  const config = customConfig || (await getActiveSmtpConfig());
  const startTime = Date.now();
  const transporter = createSmtpTransporter(config);

  try {
    await transporter.verify();
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      message: `Successfully connected and authenticated with ${config.host}:${config.port} in ${latencyMs}ms`,
      details: {
        host: config.host,
        port: config.port,
        tls: "TLSv1.2+ STARTTLS enforced",
        authenticatedUser: config.username ? `${config.username.slice(0, 4)}...${config.username.slice(-4)}` : "empty",
      },
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const error = err as Error & { code?: string; response?: string; responseCode?: number };
    return {
      success: false,
      latencyMs,
      message: error.message || "Failed to establish SMTP connection",
      details: {
        code: error.code,
        responseCode: error.responseCode,
        response: error.response,
        host: config.host,
        port: config.port,
      },
    };
  }
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  messageId?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  response?: string;
  error?: string;
  errorCode?: string;
  isTransient?: boolean;
}

export async function sendMail(
  options: SendMailOptions,
  customTransporter?: nodemailer.Transporter
): Promise<SendMailResult> {
  const config = await getActiveSmtpConfig();
  const transporter = customTransporter || getPooledTransporter(config);

  const from = `"${options.fromName || config.fromName}" <${options.fromEmail || config.fromEmail}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || config.replyTo || undefined,
      headers: options.headers,
      messageId: options.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (err: unknown) {
    const error = err as Error & { code?: string; response?: string; responseCode?: number };
    const code = error.code || (error.responseCode ? String(error.responseCode) : "UNKNOWN");
    
    // 4xx errors are transient (rate limits, graylisting, temporary DNS lookup failures)
    // 5xx errors are permanent (mailbox unavailable, user unknown, auth failed)
    const isTransient = error.responseCode ? error.responseCode >= 400 && error.responseCode < 500 : true;

    return {
      success: false,
      error: error.message || "Failed to send email via SMTP",
      errorCode: code,
      isTransient,
    };
  }
}
