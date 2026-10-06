import { CATEGORIES, MUNICIPALITIES, STAGES, STAGE_LABELS, type Stage } from "./constants.ts";

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
    next_step: string | null;
    notes: string | null;
  };
  contact: {
    name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    is_decision_maker: boolean;
  } | null;
};

type Field =
  | "name" | "org_nr" | "category" | "municipality" | "network" | "address" | "website"
  | "instagram" | "facebook" | "phone" | "source" | "is_chain" | "stage" | "next_step" | "notes"
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

export function toImportRows(
  records: Record<string, string>[],
  opts: { defaultStage: Stage; defaultSource: string | null; newId?: () => string },
): ImportRow[] {
  if (records.length === 0) return [];
  const mapping = mapHeaders(Object.keys(records[0]));
  const newId = opts.newId ?? (() => crypto.randomUUID());

  return records
    .map((rec) => {
      const v: Partial<Record<Field, string>> = {};
      for (const [header, field] of Object.entries(mapping)) {
        const val = rec[header]?.trim();
        if (field && val) v[field] = val;
      }
      const name = v.name ?? "";
      if (!name) return null;

      const stage = parseStage(v.stage) ?? opts.defaultStage;
      const contactName = v.contact_name ?? (v.contact_email || v.contact_phone ? "Kontakt" : null);

      const row: ImportRow = {
        company: {
          id: newId(),
          name,
          org_nr: v.org_nr ?? null,
          category: v.category ? matchList(v.category, CATEGORIES) : null,
          municipality: v.municipality ? matchList(v.municipality, MUNICIPALITIES) : null,
          network: v.network ?? null,
          address: v.address ?? null,
          website: v.website ?? null,
          instagram: v.instagram ?? null,
          facebook: v.facebook ?? null,
          phone: v.phone ?? null,
          source: v.source ?? opts.defaultSource,
          is_chain: parseBool(v.is_chain ?? null),
          // Sidospåren kräver anledning/datum och importeras därför inte direkt.
          stage: stage === "forlorad" || stage === "aterkom" ? opts.defaultStage : stage,
          next_step: v.next_step ?? null,
          notes: v.notes ?? null,
        },
        contact: contactName
          ? {
              name: contactName,
              role: v.contact_role ?? null,
              phone: v.contact_phone ?? null,
              email: v.contact_email ?? null,
              is_decision_maker: false,
            }
          : null,
      };
      return row;
    })
    .filter((r): r is ImportRow => r !== null);
}
