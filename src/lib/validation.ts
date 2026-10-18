import dns from "dns/promises";
import prisma from "./prisma";

// Comprehensive disposable email domain blocklist
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "getairmail.com",
  "trashmail.com",
  "dispostable.com",
  "fakeinbox.com",
  "nada.ltd",
  "mohmal.com",
  "temp-mail.org",
  "fakemailgenerator.com",
  "emailondeck.com",
  "generator.email",
  "maildrop.cc",
  "inboxkitten.com",
]);

// Common role-based mailbox prefixes
const ROLE_BASED_PREFIXES = new Set([
  "admin",
  "administrator",
  "billing",
  "compliance",
  "contact",
  "help",
  "info",
  "inquiries",
  "jobs",
  "marketing",
  "media",
  "no-reply",
  "noreply",
  "orders",
  "press",
  "privacy",
  "sales",
  "security",
  "support",
  "team",
]);

export interface EmailValidationOutput {
  email: string;
  normalizedEmail: string;
  syntaxValid: boolean;
  domainExists: boolean;
  hasMxRecords: boolean;
  isDisposable: boolean;
  isRoleBased: boolean;
  mxHost?: string;
  status: "valid_format" | "domain_valid" | "invalid" | "disposable" | "unknown" | "temporarily_unavailable";
  details: string;
}

// RFC 5322 compliant regex for safe address verification
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export async function validateEmail(
  rawEmail: string,
  options: { checkDns?: boolean; useCache?: boolean } = { checkDns: true, useCache: true }
): Promise<EmailValidationOutput> {
  const normalized = normalizeEmail(rawEmail);

  if (!normalized) {
    return {
      email: rawEmail,
      normalizedEmail: "",
      syntaxValid: false,
      domainExists: false,
      hasMxRecords: false,
      isDisposable: false,
      isRoleBased: false,
      status: "invalid",
      details: "Email address is empty or whitespace only",
    };
  }

  // 1. Syntax Validation
  if (!EMAIL_REGEX.test(normalized)) {
    return {
      email: rawEmail,
      normalizedEmail: normalized,
      syntaxValid: false,
      domainExists: false,
      hasMxRecords: false,
      isDisposable: false,
      isRoleBased: false,
      status: "invalid",
      details: "Failed RFC 5322 syntax structure check",
    };
  }

  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain || domain.indexOf(".") === -1) {
    return {
      email: rawEmail,
      normalizedEmail: normalized,
      syntaxValid: false,
      domainExists: false,
      hasMxRecords: false,
      isDisposable: false,
      isRoleBased: false,
      status: "invalid",
      details: "Missing valid local part or domain",
    };
  }

  // 2. Disposable check
  const isDisposable = DISPOSABLE_DOMAINS.has(domain.toLowerCase());
  if (isDisposable) {
    return {
      email: rawEmail,
      normalizedEmail: normalized,
      syntaxValid: true,
      domainExists: true,
      hasMxRecords: true,
      isDisposable: true,
      isRoleBased: false,
      status: "disposable",
      details: `Domain ${domain} is identified on the disposable temporary email blocklist`,
    };
  }

  // 3. Role-based prefix check
  const isRoleBased = ROLE_BASED_PREFIXES.has(localPart.toLowerCase());

  // 4. Cache check
  if (options.useCache) {
    try {
      const cached = await prisma.emailValidationResult.findUnique({
        where: { email: normalized },
      });
      if (cached) {
        // Cached within last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (cached.validatedAt > thirtyDaysAgo) {
          return {
            email: rawEmail,
            normalizedEmail: normalized,
            syntaxValid: cached.syntaxValid,
            domainExists: cached.domainExists,
            hasMxRecords: cached.hasMxRecords,
            isDisposable: cached.isDisposable,
            isRoleBased: cached.isRoleBased,
            mxHost: cached.mxHost || undefined,
            status: cached.status as EmailValidationOutput["status"],
            details: cached.details || "Retrieved from validation cache",
          };
        }
      }
    } catch {
      // Continue without cache on read error
    }
  }

  // If DNS check not requested
  if (!options.checkDns) {
    return {
      email: rawEmail,
      normalizedEmail: normalized,
      syntaxValid: true,
      domainExists: true,
      hasMxRecords: true,
      isDisposable: false,
      isRoleBased,
      status: "valid_format",
      details: "Syntax verified. DNS MX checks skipped by option.",
    };
  }

  // 5. DNS MX & A Record Resolution
  let domainExists = false;
  let hasMxRecords = false;
  let primaryMx: string | undefined;
  let status: EmailValidationOutput["status"] = "unknown";
  let details = "Validated";

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      domainExists = true;
      hasMxRecords = true;
      // Sort by priority ascending
      mxRecords.sort((a, b) => a.priority - b.priority);
      primaryMx = mxRecords[0].exchange;
      status = "domain_valid";
      details = `Verified active MX server: ${primaryMx} (priority ${mxRecords[0].priority})`;
    } else {
      // Check fallback A record (RFC 5321 fallback)
      const aRecords = await dns.resolve4(domain);
      if (aRecords && aRecords.length > 0) {
        domainExists = true;
        hasMxRecords = false;
        status = "valid_format";
        details = `Domain resolved to A record ${aRecords[0]}, but no explicit MX record found.`;
      } else {
        status = "invalid";
        details = `Domain ${domain} does not have MX or A DNS records.`;
      }
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
      domainExists = false;
      hasMxRecords = false;
      status = "invalid";
      details = `Domain ${domain} does not exist or has no DNS mail exchange records (${error.code}).`;
    } else if (error.code === "ETIMEOUT" || error.code === "ECONNREFUSED") {
      status = "temporarily_unavailable";
      details = `DNS lookup for ${domain} timed out or was temporarily refused.`;
    } else {
      status = "unknown";
      details = `DNS query ended with: ${error.message || "Unknown error"}`;
    }
  }

  const result: EmailValidationOutput = {
    email: rawEmail,
    normalizedEmail: normalized,
    syntaxValid: true,
    domainExists,
    hasMxRecords,
    isDisposable,
    isRoleBased,
    mxHost: primaryMx,
    status,
    details,
  };

  // Upsert into cache
  try {
    await prisma.emailValidationResult.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        syntaxValid: result.syntaxValid,
        domainExists: result.domainExists,
        hasMxRecords: result.hasMxRecords,
        isDisposable: result.isDisposable,
        isRoleBased: result.isRoleBased,
        mxHost: result.mxHost || null,
        status: result.status,
        details: result.details,
      },
      update: {
        syntaxValid: result.syntaxValid,
        domainExists: result.domainExists,
        hasMxRecords: result.hasMxRecords,
        isDisposable: result.isDisposable,
        isRoleBased: result.isRoleBased,
        mxHost: result.mxHost || null,
        status: result.status,
        details: result.details,
        validatedAt: new Date(),
      },
    });
  } catch {
    // Non-fatal cache failure
  }

  return result;
}
