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
 * Known titles, honorifics, and abbreviated prefixes to ignore in personalization
 */
const KNOWN_NAME_PREFIXES = new Set([
  "md",
  "mohd",
  "mst",
  "miss",
  "mrs",
  "mr",
  "ms",
  "dr",
  "prof",
  "engr",
  "adv",
]);

/**
 * Preprocess name string:
 * - Separates prefixes attached to names with dots (e.g. 'Md.mahim' -> 'Md. mahim')
 * - Separates initials with dots attached to words (e.g. 'S.m.arifur' -> 'S.m. arifur')
 */
export function preprocessName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/\b(md|mohd|mst|miss|mrs|mr|ms|dr|prof|engr|adv)\.([a-zA-Z])/gi, "$1. $2")
    .replace(/([a-zA-Z]\.)([a-zA-Z]{3,})/g, "$1 $2")
    .trim();
}

/**
 * Checks whether a token represents a short character, initial, title, or honorific prefix
 * (e.g. MD., A., A.A.M, s.m., Mst, miss, etc.)
 */
export function isShortCharOrPrefix(word: string): boolean {
  if (!word || typeof word !== "string") return true;

  // Clean edge punctuation while keeping internal dots/hyphens
  const clean = word.replace(/^[^\w]+|[^\w]+$/g, "").toLowerCase();
  if (!clean) return true;

  // Single letter words: 'a', 'm', 's', etc.
  if (clean.length === 1) return true;

  // Known honorifics/prefixes without or with dot: md, mst, miss, mr, dr, etc.
  if (KNOWN_NAME_PREFIXES.has(clean)) return true;

  // Dot patterns like A.m.m. or S.M. or A.A.M or H.M or Md.
  const dotParts = clean.split(".").filter(Boolean);
  if (dotParts.length > 1) {
    // If all sub-parts are short initials (<= 2 characters)
    if (dotParts.every((p) => p.length <= 2)) return true;
  }
  if (dotParts.length === 1 && KNOWN_NAME_PREFIXES.has(dotParts[0])) {
    return true;
  }

  // Pure uppercase abbreviations/initials (e.g., 'MD', 'MST', 'AMM', 'AKM', 'HM', 'SM')
  if (/^[A-Z]{2,4}$/.test(word)) {
    return true;
  }

  return false;
}

/**
 * Normalizes casing for each word in a string
 */
function formatCapitalizedWords(text: string): string {
  if (!text) return "";
  return text
    .split(/\s+/)
    .map((word) => {
      const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, "");
      if (!cleanWord) return word;
      if (cleanWord === cleanWord.toLowerCase() || cleanWord === cleanWord.toUpperCase()) {
        return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
      }
      return cleanWord;
    })
    .join(" ");
}

/**
 * Extracts the personalized call name based on rules:
 * 1. Filter out short characters / prefixes (MD., A., A.A.M, s.m., Mst, miss, etc.)
 * 2. If the remaining name has 2 words, select both words
 * 3. If the remaining name has 1 word, use it
 * 4. If the remaining name has > 2 words, use the last word
 */
export function extractPersonalizedName(fullName: string): string {
  if (!fullName || typeof fullName !== "string") return "";
  const preprocessed = preprocessName(fullName);
  if (!preprocessed) return "";

  const rawWords = preprocessed.split(/\s+/).filter(Boolean);
  const validWords = rawWords.filter((w) => !isShortCharOrPrefix(w));

  let chosen = "";
  if (validWords.length === 0) {
    // If every word was filtered out, fallback to first cleaned word
    chosen = rawWords[0]?.replace(/[^\w]/g, "") || preprocessed;
  } else if (validWords.length === 1) {
    // Rule 3: 1 word -> use it
    chosen = validWords[0];
  } else if (validWords.length === 2) {
    // Rule 2 (updated): 2 words -> select both words
    chosen = validWords.join(" ");
  } else {
    // Rule 4: > 2 words -> last word
    chosen = validWords[validWords.length - 1];
  }

  return formatCapitalizedWords(chosen);
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

  const rawFullName =
    contact.fullName ||
    contact.name ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    "";

  const personalizedName = extractPersonalizedName(rawFullName);

  // Standard fields
  dict["email"] = contact.email || "";
  dict["name"] = personalizedName || rawFullName;
  dict["firstName"] = personalizedName || contact.firstName || "";
  dict["lastName"] = contact.lastName || "";
  dict["fullName"] = rawFullName;
  dict["rawName"] = rawFullName;
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
