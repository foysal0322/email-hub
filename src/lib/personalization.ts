/**
 * Safe HTML escaping to prevent XSS / HTML injection in email templates
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ContactDataForPersonalization {
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  department?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  customAttributes?: Record<string, unknown> | string | null;
}

/**
 * Extract all placeholder tags like {{name}} or {{dept_name|General}} from a string
 */
export function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  const regex = /\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Build a flat dictionary of available replacement keys from contact data
 */
export function buildTokenDictionary(contact: ContactDataForPersonalization): Record<string, string> {
  const dict: Record<string, string> = {};

  // Standard fields
  dict["email"] = contact.email || "";
  dict["name"] = contact.name || contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "";
  dict["firstName"] = contact.firstName || "";
  dict["lastName"] = contact.lastName || "";
  dict["fullName"] = contact.fullName || dict["name"];
  dict["department"] = contact.department || "";
  dict["dept_name"] = contact.department || "";
  dict["organization"] = contact.organization || "";
  dict["company"] = contact.organization || "";
  dict["jobTitle"] = contact.jobTitle || "";
  dict["designation"] = contact.jobTitle || "";
  dict["phone"] = contact.phone || "";

  // Custom attributes (if JSON string or object)
  if (contact.customAttributes) {
    try {
      const parsed =
        typeof contact.customAttributes === "string"
          ? JSON.parse(contact.customAttributes)
          : contact.customAttributes;

      if (parsed && typeof parsed === "object") {
        for (const [key, val] of Object.entries(parsed)) {
          if (val !== null && val !== undefined) {
            dict[key] = String(val);
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in custom attributes
    }
  }

  return dict;
}

/**
 * Render a template string by replacing placeholders with contact attributes
 */
export function renderPersonalizedString(
  template: string,
  contact: ContactDataForPersonalization,
  options: { isHtml?: boolean } = { isHtml: false }
): string {
  if (!template) return "";
  const dict = buildTokenDictionary(contact);

  return template.replace(/\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g, (match, key, fallback) => {
    let value = dict[key];
    if (value === undefined || value === null || value === "") {
      value = fallback !== undefined ? fallback : "";
    }
    return options.isHtml ? escapeHtml(value) : value;
  });
}
