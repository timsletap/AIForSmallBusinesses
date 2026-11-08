export const CURRENT_TOOLS = [
  { id: "phone_line", label: "Business phone line", lowTech: true },
  { id: "paper", label: "Paper or notebook", lowTech: true },
  { id: "excel_sheets", label: "Excel or Google Sheets", lowTech: true },
  { id: "gmail_outlook", label: "Gmail or Outlook", lowTech: false },
  { id: "quickbooks", label: "QuickBooks", lowTech: false },
  { id: "square", label: "Square", lowTech: false },
  { id: "clover", label: "Clover", lowTech: false },
  { id: "toast", label: "Toast", lowTech: false },
  { id: "shopify", label: "Shopify", lowTech: false },
  { id: "google_business_profile", label: "Google Business Profile", lowTech: false },
  { id: "instagram_facebook", label: "Instagram or Facebook", lowTech: false },
  { id: "none", label: "None of these", lowTech: true },
] as const;

export type ToolId = (typeof CURRENT_TOOLS)[number]["id"];
export const TOOL_IDS = CURRENT_TOOLS.map((t) => t.id) as [ToolId, ...ToolId[]];
export const toolLabel = (id: string) => CURRENT_TOOLS.find((t) => t.id === id)?.label ?? id;

/** Tools that can't "integrate" with anything; matching counts only real software plus phone line. */
export const NON_INTEGRATING: ToolId[] = ["paper", "none"];

const SYNONYMS: Record<string, ToolId> = {
  phone: "phone_line",
  "phone line": "phone_line",
  "phone number": "phone_line",
  "call forwarding": "phone_line",
  voip: "phone_line",
  landline: "phone_line",
  sms: "phone_line",
  excel: "excel_sheets",
  "microsoft excel": "excel_sheets",
  "google sheets": "excel_sheets",
  sheets: "excel_sheets",
  csv: "excel_sheets",
  spreadsheet: "excel_sheets",
  gmail: "gmail_outlook",
  outlook: "gmail_outlook",
  "google workspace": "gmail_outlook",
  "microsoft 365": "gmail_outlook",
  "office 365": "gmail_outlook",
  "google calendar": "gmail_outlook",
  "outlook calendar": "gmail_outlook",
  quickbooks: "quickbooks",
  "quickbooks online": "quickbooks",
  "quickbooks desktop": "quickbooks",
  qbo: "quickbooks",
  intuit: "quickbooks",
  square: "square",
  "square pos": "square",
  "square appointments": "square",
  "square for restaurants": "square",
  clover: "clover",
  "clover pos": "clover",
  toast: "toast",
  "toast pos": "toast",
  shopify: "shopify",
  "shopify pos": "shopify",
  "google business profile": "google_business_profile",
  "google my business": "google_business_profile",
  "google reviews": "google_business_profile",
  "google maps": "google_business_profile",
  instagram: "instagram_facebook",
  facebook: "instagram_facebook",
  "facebook messenger": "instagram_facebook",
  messenger: "instagram_facebook",
  meta: "instagram_facebook",
  whatsapp: "instagram_facebook",
};

/** Normalize a free-text integration name ("Square Appointments") to a taxonomy id, or null. */
export function normalizeIntegration(raw: string): ToolId | null {
  const s = raw.toLowerCase().replace(/[®™()]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if ((TOOL_IDS as readonly string[]).includes(s)) return s as ToolId;
  if (SYNONYMS[s]) return SYNONYMS[s];
  // Longest synonym contained in the string wins ("Square for Retail" → square).
  const hit = Object.keys(SYNONYMS)
    .filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? SYNONYMS[hit] : null;
}

/**
 * Low-tech tools rarely appear in a vendor's integration list, but the vendor's own setup
 * requirements say when the tool runs on your existing business phone number.
 */
export function inferLowTechIntegrations(integrations: ToolId[], requirements: string[]): ToolId[] {
  const out = new Set(integrations);
  if (requirements.some((r) => /\b(phone (line|number)|forward(ing)? (your )?calls?|call forwarding)\b/i.test(r))) {
    out.add("phone_line");
  }
  return [...out];
}

export function normalizeIntegrations(raw: string[]): ToolId[] {
  return [...new Set(raw.map(normalizeIntegration).filter((x): x is ToolId => !!x && x !== "none"))];
}

const NOUNS: Partial<Record<ToolId, string>> = {
  phone_line: "phone line",
  paper: "paper records",
  excel_sheets: "spreadsheet",
  gmail_outlook: "email",
  instagram_facebook: "Facebook or Instagram",
};

/** Label that reads naturally mid-sentence: "Works with your Square and phone line". */
export const toolNoun = (id: string) => NOUNS[id as ToolId] ?? toolLabel(id);
