import { CATEGORIES, MAIN_STAGES, MUNICIPALITIES, STAGES, STAGE_LABELS, type Stage } from "./constants.ts";

export type ImportRow = {
  company: {
    id: string;
    name: string;
    org_nr: string | null;
    category: string | null;
    municipality: string | null;
    network: string | null;
    address: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    phone: string | null;
    source: string | null;
    is_chain: boolean | null;
    stage: Stage;
    lost_reason: string | null;
    revisit_date: string | null;
    next_step: string | null;
    notes: string | null;
  };
  contacts: ImportContact[];
};

export type ImportContact = {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_decision_maker: boolean;
};

type Field =
  | "name" | "org_nr" | "category" | "municipality" | "network" | "address" | "website"
  | "instagram" | "facebook" | "phone" | "source" | "is_chain" | "stage" | "next_step" | "notes"
  | "lost_reason" | "revisit_date"
  | "contact_name" | "contact_role" | "contact_phone" | "contact_email";

const ALIASES: Record<Field, string[]> = {
  name: ["namn", "företag", "foretag", "företagsnamn", "name", "company", "butik"],
  org_nr: ["orgnr", "org.nr", "org nr", "organisationsnummer", "org_nr"],
  category: ["kategori", "category", "bransch"],
  municipality: ["kommun", "stad", "ort", "municipality", "city"],
  network: ["nätverk", "natverk", "plats", "köpcentrum", "network", "galleria"],
  address: ["adress", "address", "gatuadress"],
  website: ["webb", "hemsida", "webbplats", "website", "url"],
  instagram: ["instagram", "ig"],
  facebook: ["facebook", "fb"],
  phone: ["telefon", "tel", "phone", "företagstelefon"],
  source: ["källa", "kalla", "source"],
  is_chain: ["kedja", "chain"],
  stage: ["steg", "status", "stage", "pipeline"],
  next_step: ["nästa steg", "next step"],
  lost_reason: ["förlustanledning", "anledning", "lost reason"],
  revisit_date: ["återkom datum", "återkom", "revisit date"],
  notes: ["anteckning", "anteckningar", "notes", "kommentar"],
  contact_name: ["kontaktperson", "kontakt", "contact", "contact name", "ägare"],
  contact_role: ["roll", "role", "titel"],
  contact_phone: ["kontakttelefon", "kontakt telefon", "mobil", "contact phone"],
  contact_email: ["mejl", "e-post", "epost", "email", "e-mail", "mail"],
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");

/** Gissar vilket fält varje kolumnrubrik motsvarar. */
export function mapHeaders(headers: string[]): Record<string, Field | null> {
  const out: Record<string, Field | null> = {};
  const taken = new Set<Field>();
  for (const h of headers) {
    const n = normalize(h);
    let match: Field | null = null;
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
      if (!taken.has(field) && aliases.includes(n)) {
        match = field;
        break;
      }
    }
    if (match) taken.add(match);
    out[h] = match;
  }
  return out;
}

function matchList(value: string, list: readonly string[]): string {
  const n = normalize(value);
  return list.find((x) => normalize(x) === n) ?? value.trim();
}

export function parseStage(value: string | null | undefined): Stage | null {
  if (!value) return null;
  const n = normalize(value);
  for (const s of STAGES) {
    if (n === s || n === normalize(STAGE_LABELS[s])) return s;
  }
  if (["betalande", "betald", "partner", "kund", "betalande partner"].includes(n)) return "betald";
  if (["möte", "mote"].includes(n)) return "mote_bokat";
  return null;
}

function parseBool(value: string | null): boolean | null {
  if (!value) return null;
  const n = normalize(value);
  if (["ja", "j", "yes", "y", "true", "1", "x"].includes(n)) return true;
  if (["nej", "n", "no", "false", "0"].includes(n)) return false;
  return null;
}

const companyKey = (name: string, municipality: string | null) =>
  `${name.trim().toLowerCase()}|${(municipality ?? "").trim().toLowerCase()}`;

/**
 * Gör om CSV-rader till företag. Flera rader för samma företag (samma namn och kommun)
 * slås ihop: kontaktpersonerna samlas på ett företag och anteckningarna läggs ihop.
 */
export function toImportRows(
  records: Record<string, string>[],
  opts: { defaultStage: Stage; defaultSource: string | null; newId?: () => string },
): ImportRow[] {
  if (records.length === 0) return [];
  const mapping = mapHeaders(Object.keys(records[0]));
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const byKey = new Map<string, ImportRow>();

  for (const rec of records) {
    const v: Partial<Record<Field, string>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      const val = rec[header]?.trim();
      if (field && val) v[field] = val;
    }
    const name = v.name ?? "";
    if (!name) continue;

    const municipality = v.municipality ? matchList(v.municipality, MUNICIPALITIES) : null;
    const contactName = v.contact_name ?? (v.contact_email || v.contact_phone ? "Kontakt" : null);
    const contact: ImportContact | null = contactName
      ? { name: contactName, role: v.contact_role ?? null, phone: v.contact_phone ?? null, email: v.contact_email ?? null, is_decision_maker: false }
      : null;

    const key = companyKey(name, municipality);
    const existing = byKey.get(key);
    if (existing) {
      if (contact && !existing.contacts.some((c) => c.name === contact.name && c.email === contact.email)) existing.contacts.push(contact);
      // Behåll det steg som kommit längst i huvudflödet.
      const later = parseStage(v.stage);
      if (later && MAIN_STAGES.indexOf(later) > MAIN_STAGES.indexOf(existing.company.stage)) existing.company.stage = later;
      if (v.notes && !existing.company.notes?.includes(v.notes)) {
        existing.company.notes = existing.company.notes ? `${existing.company.notes}\n${v.notes}` : v.notes;
      }
      continue;
    }

    // Sidospåren kräver anledning resp. datum – saknas det används standardsteget.
    let stage = parseStage(v.stage) ?? opts.defaultStage;
    const revisit = v.revisit_date && /^\d{4}-\d{2}-\d{2}$/.test(v.revisit_date) ? v.revisit_date : null;
    if ((stage === "forlorad" && !v.lost_reason) || (stage === "aterkom" && !revisit)) stage = opts.defaultStage;

    byKey.set(key, {
      company: {
        id: newId(),
        name,
        org_nr: v.org_nr ?? null,
        category: v.category ? matchList(v.category, CATEGORIES) : null,
        municipality,
        network: v.network ?? null,
        address: v.address ?? null,
        website: v.website ?? null,
        instagram: v.instagram ?? null,
        facebook: v.facebook ?? null,
        phone: v.phone ?? null,
        source: v.source ?? opts.defaultSource,
        is_chain: parseBool(v.is_chain ?? null),
        stage,
        lost_reason: stage === "forlorad" ? v.lost_reason! : null,
        revisit_date: stage === "aterkom" ? revisit : null,
        next_step: v.next_step ?? null,
        notes: v.notes ?? null,
      },
      contacts: contact ? [contact] : [],
    });
  }
  return [...byKey.values()];
}
