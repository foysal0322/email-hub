import crypto from "crypto";
import prisma from "./prisma";

const SECRET = process.env.SESSION_SECRET || "default-tracking-secret-key-32-chars";

/**
 * Generate a tamper-proof signed unsubscribe token for an email address and optional campaign
 */
export function generateUnsubscribeToken(email: string, campaignId?: string): string {
  const payload = `${email.toLowerCase()}|${campaignId || ""}|${Date.now()}`;
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

/**
 * Verify and decode an unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): { valid: boolean; email?: string; campaignId?: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return { valid: false };

    const [email, campaignId, timestamp, hmac] = parts;
    const expectedHmac = crypto
      .createHmac("sha256", SECRET)
      .update(`${email}|${campaignId}|${timestamp}`)
      .digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return { valid: true, email, campaignId: campaignId || undefined };
    }
  } catch {
    // Malformed token
  }
  return { valid: false };
}

/**
 * Helper to check if a base URL points to localhost or a private loopback address.
 * External email recipients cannot access localhost, so tracking redirects and pixels
 * should NEVER point to localhost in outgoing emails.
 */
export function isLocalhost(urlStr?: string): boolean {
  if (!urlStr) return true;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".localhost")
    );
  } catch {
    const lower = urlStr.toLowerCase();
    return (
      lower.includes("localhost") ||
      lower.includes("127.0.0.1") ||
      lower.includes("0.0.0.0")
    );
  }
}

/**
 * Prepares an email HTML body by rewriting links for click tracking and injecting the open tracking pixel
 */
export async function prepareTrackedEmailContent(params: {
  html: string;
  messageId: string;
  trackingId: string;
  campaignId?: string;
  recipientEmail: string;
  baseUrl: string;
  enableOpenTracking?: boolean;
  enableClickTracking?: boolean;
}): Promise<{ html: string; unsubscribeUrl: string; headers: Record<string, string> }> {
  let processedHtml = params.html;
  const baseUrl = (params.baseUrl || "").replace(/\/$/, "");
  const isLocal = isLocalhost(baseUrl);

  // Generate unsubscribe link
  const unsubToken = generateUnsubscribeToken(params.recipientEmail, params.campaignId);
  const unsubscribeUrl = isLocal ? "#unsubscribe" : `${baseUrl}/unsubscribe?token=${unsubToken}`;

  // 1. Click tracking: Rewrite links ONLY if click tracking is enabled AND baseUrl is NOT localhost
  // If baseUrl is localhost/127.0.0.1, rewriting links causes them to point to localhost on the recipient's machine, breaking them!
  if (params.enableClickTracking !== false && !isLocal) {
    const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // Collect all links
    while ((match = hrefRegex.exec(processedHtml)) !== null) {
      const url = match[1];
      if (!url.includes("/api/track/") && !url.includes("/unsubscribe")) {
        matches.push(url);
      }
    }

    // Rewrite unique URLs
    for (const originalUrl of Array.from(new Set(matches))) {
      try {
        const linkRecord = await prisma.emailLink.create({
          data: {
            messageId: params.messageId,
            campaignId: params.campaignId || null,
            targetUrl: originalUrl,
          },
        });

        const trackingRedirectUrl = `${baseUrl}/api/track/click/${linkRecord.id}`;
        // Replace all occurrences of this URL in href attributes
        const targetPattern = new RegExp(`href=["']${escapeRegExp(originalUrl)}["']`, "g");
        processedHtml = processedHtml.replace(targetPattern, `href="${trackingRedirectUrl}"`);
      } catch {
        // If DB write fails, keep original link
      }
    }
  }

  // 2. Open tracking: Inject transparent 1x1 GIF tracking pixel ONLY if baseUrl is public
  if (params.enableOpenTracking !== false && !isLocal) {
    const trackingPixelUrl = `${baseUrl}/api/track/open/${params.trackingId}`;
    const pixelTag = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;" />`;

    if (processedHtml.includes("</body>")) {
      processedHtml = processedHtml.replace("</body>", `${pixelTag}</body>`);
    } else {
      processedHtml += pixelTag;
    }
  }

  // 3. Inject standard Unsubscribe footer if not present (only when public URL is configured)
  if (!isLocal) {
    if (!processedHtml.includes("/unsubscribe") && !processedHtml.includes("{{unsubscribe_url}}")) {
      const unsubFooter = `
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
          <p>You received this email because you are a valued contact. If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #4f46e5; text-decoration: underline;">unsubscribe here</a>.</p>
        </div>
      `;

      if (processedHtml.includes("</body>")) {
        processedHtml = processedHtml.replace("</body>", `${unsubFooter}</body>`);
      } else {
        processedHtml += unsubFooter;
      }
    } else {
      // Replace {{unsubscribe_url}} token if author explicitly placed it
      processedHtml = processedHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
    }
  } else {
    // If local, safely replace {{unsubscribe_url}} placeholder if author placed it
    processedHtml = processedHtml.replace(/\{\{unsubscribe_url\}\}/g, "#unsubscribe");
  }

  // 4. Standard RFC 2369 & RFC 8058 headers for one-click unsubscribe (only if public domain is available)
  const headers: Record<string, string> = {
    "X-Mailer": "EmailHub-Engine/1.0",
  };

  if (!isLocal) {
    headers["List-Unsubscribe"] = `<${baseUrl}/api/unsubscribe?token=${unsubToken}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return { html: processedHtml, unsubscribeUrl, headers };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
