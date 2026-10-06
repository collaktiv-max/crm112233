"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPES, CHANNELS, PACKAGES, STAGES, isStage, type Stage } from "@/lib/constants";
import type { ImportRow } from "@/lib/csv";

export type ActionResult = { error: string } | { ok: true } | null;

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** "ja"/"nej"/"" → true/false/null */
function triState(fd: FormData, key: string): boolean | null {
  const v = str(fd, key);
  if (v === "ja") return true;
  if (v === "nej") return false;
  return null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

function stageError(stage: Stage, lostReason: string | null, revisitDate: string | null): string | null {
  if (stage === "forlorad" && !lostReason) return "Ange en anledning till att företaget är förlorat.";
  if (stage === "aterkom" && !revisitDate) return "Ange när företaget ska dyka upp igen.";
  return null;
}

function companyFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    org_nr: str(fd, "org_nr"),
    category: str(fd, "category"),
    municipality: str(fd, "municipality"),
    network: str(fd, "network"),
    address: str(fd, "address"),
    website: str(fd, "website"),
    instagram: str(fd, "instagram"),
    facebook: str(fd, "facebook"),
    phone: str(fd, "phone"),
    source: str(fd, "source"),
    is_chain: triState(fd, "is_chain"),
    is_sole_trader: bool(fd, "is_sole_trader"),
    near_transit: bool(fd, "near_transit"),
    next_step: str(fd, "next_step"),
    next_step_date: str(fd, "next_step_date"),
    notes: str(fd, "notes"),
  };
}

// ---------------------------------------------------------------------------
// Företag
// ---------------------------------------------------------------------------

export async function createCompany(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const fields = companyFields(fd);
  if (!fields.name) return { error: "Namn krävs." };
  const stage = oneOf(str(fd, "stage"), STAGES) ?? "prospekt";
  const lost_reason = str(fd, "lost_reason");
  const revisit_date = str(fd, "revisit_date");
  const err = stageError(stage, lost_reason, revisit_date);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...fields, stage, lost_reason, revisit_date })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const contactName = str(fd, "contact_name");
  if (contactName) {
    await supabase.from("contacts").insert({
      company_id: data.id,
      name: contactName,
      role: str(fd, "contact_role"),
      phone: str(fd, "contact_phone"),
      email: str(fd, "contact_email"),
      is_decision_maker: bool(fd, "contact_decision_maker"),
    });
  }

  refresh();
  redirect(`/foretag/${data.id}`);
}

export async function updateCompany(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const fields = companyFields(fd);
  if (!fields.name) return { error: "Namn krävs." };
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(fields).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  redirect(`/foretag/${id}`);
}

export async function deleteCompany(id: string) {
  const supabase = await createClient();
  await supabase.from("companies").delete().eq("id", id);
  refresh();
  redirect("/foretag");
}

export async function moveStage(
  id: string,
  stage: Stage,
  extra: { lost_reason?: string | null; revisit_date?: string | null } = {},
): Promise<ActionResult> {
  if (!isStage(stage)) return { error: "Okänt steg." };
  const lost_reason = extra.lost_reason?.trim() || null;
  const revisit_date = extra.revisit_date || null;
  const err = stageError(stage, lost_reason, revisit_date);
  if (err) return { error: err };

  const supabase = await createClient();
  const patch: Record<string, unknown> = { stage };
  if (stage === "forlorad") patch.lost_reason = lost_reason;
  if (stage === "aterkom") patch.revisit_date = revisit_date;
  const { error } = await supabase.from("companies").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function toggleUnsubscribed(id: string, unsubscribed: boolean) {
  const supabase = await createClient();
  await supabase
    .from("companies")
    .update({ unsubscribed_at: unsubscribed ? new Date().toISOString() : null })
    .eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Snabblogg
// ---------------------------------------------------------------------------

export async function quickLog(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const company_id = str(fd, "company_id");
  const type = oneOf(str(fd, "type"), ACTIVITY_TYPES);
  if (!company_id) return { error: "Välj ett företag." };
  if (!type) return { error: "Välj typ av kontakt." };

  const stage = oneOf(str(fd, "stage"), STAGES);
  const lost_reason = str(fd, "lost_reason");
  const revisit_date = str(fd, "revisit_date");
  const next_step = str(fd, "next_step");
  const next_step_date = str(fd, "next_step_date");
  if (stage) {
    const err = stageError(stage, lost_reason, revisit_date);
    if (err) return { error: err };
  }

  const supabase = await createClient();
  const { error: actErr } = await supabase.from("activities").insert({
    company_id,
    type,
    outcome: str(fd, "outcome"),
    objection: str(fd, "objection"),
    note: str(fd, "note"),
  });
  if (actErr) return { error: actErr.message };

  const patch: Record<string, unknown> = { next_step, next_step_date };
  if (stage) {
    patch.stage = stage;
    if (stage === "forlorad") patch.lost_reason = lost_reason;
    if (stage === "aterkom") patch.revisit_date = revisit_date;
  }
  const { error: compErr } = await supabase.from("companies").update(patch).eq("id", company_id);
  if (compErr) return { error: compErr.message };

  // Ett uttryckligt nästa steg ersätter stegets automatiska påminnelse
  // (utom inför bokade möten, där påminnelsen dagen före behålls).
  if (next_step_date && stage !== "forlorad" && stage !== "aterkom") {
    if (stage !== "mote_bokat") {
      await supabase
        .from("tasks")
        .update({ done: true })
        .eq("company_id", company_id)
        .eq("done", false)
        .not("auto_stage", "is", null);
    }
    await supabase.from("tasks").insert({
      company_id,
      title: next_step ?? "Följ upp",
      due_date: next_step_date,
    });
  }

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Uppgifter
// ---------------------------------------------------------------------------

export async function setTaskDone(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("tasks").update({ done }).eq("id", id);
  refresh();
}

export async function postponeTask(id: string, due_date: string) {
  const supabase = await createClient();
  await supabase.from("tasks").update({ due_date }).eq("id", id);
  refresh();
}

export async function createTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const title = str(fd, "title");
  const due_date = str(fd, "due_date");
  if (!title || !due_date) return { error: "Ange vad och när." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert({ title, due_date, company_id: str(fd, "company_id") });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Kontaktpersoner
// ---------------------------------------------------------------------------

export async function addContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const company_id = str(fd, "company_id");
  const name = str(fd, "name");
  if (!company_id || !name) return { error: "Namn krävs." };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    company_id,
    name,
    role: str(fd, "role"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    preferred_channel: oneOf(str(fd, "preferred_channel"), CHANNELS),
    is_decision_maker: bool(fd, "is_decision_maker"),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Avtal
// ---------------------------------------------------------------------------

export async function saveContract(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const company_id = str(fd, "company_id");
  if (!company_id) return { error: "Företag saknas." };
  const id = str(fd, "id");
  const amount = str(fd, "amount_paid");
  const row = {
    company_id,
    package: oneOf(str(fd, "package"), PACKAGES) ?? "standard",
    founding_partner: bool(fd, "founding_partner"),
    amount_paid: amount ? Math.round(Number(amount.replace(/\s/g, "").replace(",", "."))) : null,
    paid_at: str(fd, "paid_at"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
  };
  if (row.amount_paid !== null && !Number.isFinite(row.amount_paid)) return { error: "Ogiltigt belopp." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("contracts").update(row).eq("id", id)
    : await supabase.from("contracts").insert(row);
  if (error) return { error: error.message };

  // Betalning registrerad → Betald partner (om företaget inte redan är längre fram).
  if (row.paid_at) {
    await supabase
      .from("companies")
      .update({ stage: "betald" })
      .eq("id", company_id)
      .in("stage", ["prospekt", "kontaktad", "dialog", "mote_bokat", "onboarding", "aterkom"]);
  }

  refresh();
  return { ok: true };
}

export async function deleteContract(id: string) {
  const supabase = await createClient();
  await supabase.from("contracts").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// CSV-import
// ---------------------------------------------------------------------------

export async function importCompanies(
  rows: ImportRow[],
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const supabase = await createClient();
  const { data: existing, error: exErr } = await supabase.from("companies").select("name, municipality");
  if (exErr) return { inserted: 0, skipped: 0, error: exErr.message };

  const key = (name: string, municipality: string | null) =>
    `${name.trim().toLowerCase()}|${(municipality ?? "").trim().toLowerCase()}`;
  const seen = new Set((existing ?? []).map((c) => key(c.name, c.municipality)));

  let skipped = 0;
  const fresh: ImportRow[] = [];
  for (const r of rows) {
    const k = key(r.company.name, r.company.municipality);
    if (!r.company.name || seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    fresh.push(r);
  }
  if (fresh.length === 0) return { inserted: 0, skipped };

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert(fresh.map((r) => r.company))
    .select("id");
  if (error) return { inserted: 0, skipped, error: error.message };

  const contacts = fresh.flatMap((r) => (r.contact ? [{ ...r.contact, company_id: r.company.id }] : []));
  if (contacts.length > 0) {
    const { error: cErr } = await supabase.from("contacts").insert(contacts);
    if (cErr) return { inserted: inserted.length, skipped, error: `Kontaktpersoner: ${cErr.message}` };
  }

  refresh();
  return { inserted: inserted.length, skipped };
}
