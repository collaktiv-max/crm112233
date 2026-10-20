import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ACTIVITY_TYPES,
  CATEGORIES,
  CHANNELS,
  FOUNDING_PARTNER_SLOTS,
  GOAL_DEADLINE,
  GOAL_PARTNERS,
  MUNICIPALITIES,
  NETWORKS,
  SIGNED_STAGES,
  STAGE_LABELS,
  STAGES,
  type Stage,
} from "@/lib/constants";
import { addDays, daysBetween, today } from "@/lib/dates";
import { explainDbError } from "@/lib/dbErrors";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { CLAUDE_ACTOR, CLAUDE_STAGES, companyDomain } from "./rules";
import { serviceKey } from "./config";

export { mcpConfigError } from "./config";

const INSTRUCTIONS = `Collaktiv CRM – säljstöd för att sälja partnerskap (Standard 500 kr/mån, Premium 700 kr/mån,
6-månaderspaket, Founding Partner −20 %, max 25) till lokala företag i Gävleborg. Mål: ${GOAL_PARTNERS} betalande före ${GOAL_DEADLINE}.

Regler:
- Svara och skriv på svenska.
- Skicka aldrig mejl. Skapa bara utkast (Gmail-kopplingens draft-funktion) som användaren själv granskar och skickar.
- Ändra aldrig betalstatus eller avtal. Stegen "betald" och "live" sätts bara av en människa i appen.
- Kontakta aldrig företag där do_not_contact är true (de har tackat nej till utskick).
- Spara bara jobbkontakter (jobbmejl, jobbtelefon). Inga privata uppgifter.
- Logga varje kontakt med crm_log_activity och sätt alltid ett nästa steg med datum när det finns ett.
- När användaren vill ha en påminnelse i kalendern: skapa uppgiften med crm_create_task OCH en händelse
  i Google Kalender med företagsnamnet i titeln.
- Fråga hellre än att gissa om vilket företag som avses när flera matchar.`;

type Ctx = { db: SupabaseClient; ownerId: string };

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function dbFail(error: { code?: string; message: string }) {
  return fail(explainDbError(error) ?? error.message);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum som ÅÅÅÅ-MM-DD");
const stageEnum = z.enum(STAGES as unknown as [Stage, ...Stage[]]);
const claudeStageEnum = z.enum(CLAUDE_STAGES);

/** Claude agerar som användaren i MCP_USER_EMAIL (sätter owner_id), men loggar som "Claude". */
async function createContext(): Promise<Ctx> {
  const db = createClient(SUPABASE_URL, serviceKey()!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = process.env.MCP_USER_EMAIL!.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Kunde inte läsa användare: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return { db, ownerId: user.id };
    if (data.users.length < 200) break;
  }
  throw new Error(`Hittar inget konto för MCP_USER_EMAIL (${email}) i Supabase.`);
}

const COMPANY_LIST_FIELDS =
  "id, name, stage, priority_score, category, municipality, network, address, next_step, next_step_date, last_contact_at, revisit_date, unsubscribed_at";

function slimCompany(c: Record<string, unknown>) {
  const { unsubscribed_at, ...rest } = c;
  return { ...rest, stage_label: STAGE_LABELS[c.stage as Stage], do_not_contact: !!unsubscribed_at };
}

export async function createCrmServer(): Promise<McpServer> {
  const ctx = await createContext();
  const { db, ownerId } = ctx;

  const server = new McpServer({ name: "collaktiv-crm", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  // -------------------------------------------------------------------------
  // Läsa
  // -------------------------------------------------------------------------

  server.registerTool(
    "crm_today",
    {
      title: "Dagens läge",
      description:
        "Start here for a daily overview: overdue and today's tasks, meetings booked today, companies due for re-contact, and today's prospect list (highest priority first, grouped by area so visits can be combined in one trip). Use for morning briefings and 'what should I do today'.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const t = today();
      const [tasks, meetings, revisit, prospects] = await Promise.all([
        db.from("tasks").select("id, title, due_date, companies(id, name)").eq("done", false).lte("due_date", addDays(t, 2)).order("due_date"),
        db.from("companies").select(COMPANY_LIST_FIELDS).eq("stage", "mote_bokat").eq("next_step_date", t),
        db.from("companies").select(COMPANY_LIST_FIELDS).eq("stage", "aterkom").lte("revisit_date", t),
        db.from("companies").select(COMPANY_LIST_FIELDS).eq("stage", "prospekt").is("unsubscribed_at", null).order("priority_score", { ascending: false }).limit(12),
      ]);
      const err = tasks.error ?? meetings.error ?? revisit.error ?? prospects.error;
      if (err) return dbFail(err);
      const all = tasks.data ?? [];
      return ok({
        today: t,
        overdue_tasks: all.filter((x) => x.due_date < t),
        tasks_today: all.filter((x) => x.due_date === t),
        tasks_next_two_days: all.filter((x) => x.due_date > t),
        meetings_today: (meetings.data ?? []).map(slimCompany),
        revisit_now: (revisit.data ?? []).map(slimCompany),
        prospects_to_visit: (prospects.data ?? []).map(slimCompany),
      });
    },
  );

  server.registerTool(
    "crm_search_companies",
    {
      title: "Sök företag",
      description:
        "Search companies by name (partial match) and/or filter by pipeline stage, municipality, network (shopping centre/retail association) or category. Returns a compact list sorted by priority score. Use crm_get_company for full details.",
      inputSchema: {
        query: z.string().optional().describe("Part of the company name"),
        stage: stageEnum.optional(),
        municipality: z.string().optional().describe(`e.g. ${MUNICIPALITIES.slice(0, 4).join(", ")}`),
        network: z.string().optional().describe(`e.g. ${NETWORKS.join(", ")}`),
        category: z.string().optional().describe(`One of: ${CATEGORIES.join(", ")}`),
        limit: z.number().int().min(1).max(100).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, stage, municipality, network, category, limit }) => {
      let q = db.from("companies").select(COMPANY_LIST_FIELDS);
      if (query) q = q.ilike("name", `%${query.replace(/[%_,()]/g, "")}%`);
      if (stage) q = q.eq("stage", stage);
      if (municipality) q = q.ilike("municipality", municipality);
      if (network) q = q.ilike("network", network);
      if (category) q = q.ilike("category", category);
      const { data, error } = await q.order("priority_score", { ascending: false }).order("name").limit(limit);
      if (error) return dbFail(error);
      return ok({ count: data.length, companies: data.map(slimCompany) });
    },
  );

  server.registerTool(
    "crm_get_company",
    {
      title: "Företagskort",
      description:
        "Full company card: details, contacts (with work email/phone for drafting messages), contract status (read-only), open tasks and the last 20 activities. Check do_not_contact before drafting any outreach.",
      inputSchema: { company_id: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ company_id }) => {
      const [company, contacts, contracts, activities, tasks] = await Promise.all([
        db.from("companies").select("*").eq("id", company_id).maybeSingle(),
        db.from("contacts").select("id, name, role, email, phone, preferred_channel, is_decision_maker").eq("company_id", company_id),
        db.from("contracts").select("package, founding_partner, list_price, paid_at, start_date, end_date").eq("company_id", company_id),
        db.from("activities").select("type, occurred_at, outcome, objection, note, logged_by").eq("company_id", company_id).order("occurred_at", { ascending: false }).limit(20),
        db.from("tasks").select("id, title, due_date").eq("company_id", company_id).eq("done", false).order("due_date"),
      ]);
      const err = company.error ?? contacts.error ?? contracts.error ?? activities.error ?? tasks.error;
      if (err) return dbFail(err);
      if (!company.data) return fail("Hittar inget företag med det id:t.");
      const { owner_id: _owner, ...c } = company.data;
      void _owner;
      return ok({
        company: slimCompany(c),
        contacts: contacts.data,
        contracts: contracts.data,
        open_tasks: tasks.data,
        recent_activities: activities.data,
      });
    },
  );

  server.registerTool(
    "crm_find_by_email",
    {
      title: "Hitta företag från mejladress",
      description:
        "Find which company an email address belongs to: exact match on a contact's email, otherwise the email domain against contacts' domains and company websites. Use when processing incoming/outgoing Gmail messages to log them on the right company.",
      inputSchema: { email: z.string().email() },
      annotations: { readOnlyHint: true },
    },
    async ({ email }) => {
      const lower = email.toLowerCase();
      const exact = await db.from("contacts").select("name, email, companies(" + COMPANY_LIST_FIELDS + ")").ilike("email", lower);
      if (exact.error) return dbFail(exact.error);
      if (exact.data.length) return ok({ match: "exact_contact", results: exact.data });
      const domain = companyDomain(lower);
      if (!domain) return ok({ match: "none", note: "Gratis-mejladress utan träff – fråga användaren vilket företag det gäller." });
      const [byContact, byWebsite] = await Promise.all([
        db.from("contacts").select("name, email, companies(" + COMPANY_LIST_FIELDS + ")").ilike("email", `%@${domain}`),
        db.from("companies").select(COMPANY_LIST_FIELDS).ilike("website", `%${domain}%`),
      ]);
      const err = byContact.error ?? byWebsite.error;
      if (err) return dbFail(err);
      const contacts = byContact.data ?? [];
      const sites = byWebsite.data ?? [];
      if (!contacts.length && !sites.length) return ok({ match: "none", domain });
      return ok({ match: "domain", domain, contacts, companies: sites.map(slimCompany) });
    },
  );

  server.registerTool(
    "crm_pipeline_summary",
    {
      title: "Pipeline och mål",
      description: "Counts per pipeline stage, signed partners vs goal, required weekly pace, Founding Partner slots left, and the most common lost reasons.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [companies, founding] = await Promise.all([
        db.from("companies").select("stage, lost_reason"),
        db.from("contracts").select("id", { count: "exact", head: true }).eq("founding_partner", true),
      ]);
      const err = companies.error ?? founding.error;
      if (err) return dbFail(err);
      const byStage: Record<string, number> = {};
      const lost: Record<string, number> = {};
      const rows = companies.data ?? [];
      for (const c of rows) {
        byStage[STAGE_LABELS[c.stage as Stage]] = (byStage[STAGE_LABELS[c.stage as Stage]] ?? 0) + 1;
        if (c.stage === "forlorad") lost[c.lost_reason ?? "Okänd"] = (lost[c.lost_reason ?? "Okänd"] ?? 0) + 1;
      }
      const signed = rows.filter((c) => SIGNED_STAGES.includes(c.stage as Stage)).length;
      const weeksLeft = Math.max(1, daysBetween(today(), GOAL_DEADLINE) / 7);
      return ok({
        signed,
        goal: GOAL_PARTNERS,
        needed_per_week: Math.round(((GOAL_PARTNERS - signed) / weeksLeft) * 10) / 10,
        founding_partner_slots_left: FOUNDING_PARTNER_SLOTS - (founding.count ?? 0),
        by_stage: byStage,
        lost_reasons: lost,
      });
    },
  );

  // -------------------------------------------------------------------------
  // Skriva
  // -------------------------------------------------------------------------

  server.registerTool(
    "crm_create_company",
    {
      title: "Nytt företag",
      description:
        "Add a new company (prospect by default), optionally with one work contact. Search first with crm_search_companies to avoid duplicates. Always record where the company was found in `source`.",
      inputSchema: {
        name: z.string().min(1),
        category: z.string().optional().describe(`One of: ${CATEGORIES.join(", ")}`),
        municipality: z.string().optional(),
        network: z.string().optional(),
        address: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        phone: z.string().optional(),
        source: z.string().describe("Where the company was found, e.g. 'Gävle City medlemslista', 'tips från Kafé X'"),
        is_chain: z.boolean().optional(),
        near_transit: z.boolean().optional(),
        stage: claudeStageEnum.default("prospekt"),
        notes: z.string().optional(),
        contact: z
          .object({
            name: z.string(),
            role: z.string().optional(),
            email: z.string().email().optional().describe("Work email only"),
            phone: z.string().optional().describe("Work phone only"),
            is_decision_maker: z.boolean().default(false),
          })
          .optional(),
      },
    },
    async ({ contact, stage, ...fields }) => {
      if (stage === "forlorad" || stage === "aterkom") return fail("Skapa företaget först och flytta det sedan med crm_move_stage.");
      const { data, error } = await db.from("companies").insert({ ...fields, stage, owner_id: ownerId }).select("id, name, priority_score").single();
      if (error) return dbFail(error);
      if (contact) {
        const res = await db.from("contacts").insert({ ...contact, company_id: data.id, owner_id: ownerId });
        if (res.error) return dbFail(res.error);
      }
      return ok({ created: data });
    },
  );

  server.registerTool(
    "crm_update_company",
    {
      title: "Uppdatera företag",
      description:
        "Update descriptive fields or the next step of a company. Cannot change stage (use crm_move_stage) or anything about payment/contracts.",
      inputSchema: {
        company_id: z.string().uuid(),
        next_step: z.string().optional(),
        next_step_date: isoDate.optional(),
        notes: z.string().optional().describe("Replaces the notes field – include existing notes if they should be kept"),
        category: z.string().optional(),
        municipality: z.string().optional(),
        network: z.string().optional(),
        address: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        phone: z.string().optional(),
        is_chain: z.boolean().optional(),
        near_transit: z.boolean().optional(),
        unsubscribed: z.boolean().optional().describe("true if the company asked not to be contacted again"),
      },
      annotations: { idempotentHint: true },
    },
    async ({ company_id, unsubscribed, ...fields }) => {
      const patch: Record<string, unknown> = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (unsubscribed !== undefined) patch.unsubscribed_at = unsubscribed ? new Date().toISOString() : null;
      if (!Object.keys(patch).length) return fail("Inget att uppdatera.");
      const { data, error } = await db.from("companies").update(patch).eq("id", company_id).select("id, name, priority_score").maybeSingle();
      if (error) return dbFail(error);
      if (!data) return fail("Hittar inget företag med det id:t.");
      return ok({ updated: data });
    },
  );

  server.registerTool(
    "crm_move_stage",
    {
      title: "Flytta i pipelinen",
      description:
        "Move a company to another pipeline stage. Moving creates the stage's automatic follow-up task. 'forlorad' requires lost_reason, 'aterkom' requires revisit_date. Claude may NOT set 'betald' or 'live' – payment status is only changed by a human.",
      inputSchema: {
        company_id: z.string().uuid(),
        stage: claudeStageEnum,
        lost_reason: z.string().optional().describe("Required for forlorad: e.g. Pris, Timing, Ej intresserad"),
        revisit_date: isoDate.optional().describe("Required for aterkom"),
      },
    },
    async ({ company_id, stage, lost_reason, revisit_date }) => {
      if (stage === "forlorad" && !lost_reason) return fail("Ange lost_reason när ett företag markeras som förlorat.");
      if (stage === "aterkom" && !revisit_date) return fail("Ange revisit_date för Återkom senare.");
      const current = await db.from("companies").select("stage").eq("id", company_id).maybeSingle();
      if (current.error) return dbFail(current.error);
      if (!current.data) return fail("Hittar inget företag med det id:t.");
      if (SIGNED_STAGES.includes(current.data.stage as Stage)) {
        return fail("Företaget är betalande partner – Claude får inte ändra steg för betalande företag.");
      }
      const patch: Record<string, unknown> = { stage };
      if (stage === "forlorad") patch.lost_reason = lost_reason;
      if (stage === "aterkom") patch.revisit_date = revisit_date;
      const { error } = await db.from("companies").update(patch).eq("id", company_id);
      if (error) return dbFail(error);
      return ok({ moved_to: STAGE_LABELS[stage] });
    },
  );

  server.registerTool(
    "crm_log_activity",
    {
      title: "Logga kontakt",
      description:
        "Log a visit, call, email or DM on a company, optionally with a new stage and the next step + date (which also creates a follow-up task). Use after sending/receiving emails or after the user reports a visit/call. Set occurred_at for things that happened earlier.",
      inputSchema: {
        company_id: z.string().uuid(),
        type: z.enum(ACTIVITY_TYPES),
        outcome: z.string().optional().describe("e.g. Positiv, Vill ha mer info, Ej på plats / inget svar, Återkom senare, Nej tack"),
        note: z.string().optional(),
        objection: z.string().optional().describe("e.g. Pris, Timing, Ser inte nyttan"),
        occurred_at: z.string().datetime({ offset: true }).optional(),
        new_stage: claudeStageEnum.optional(),
        lost_reason: z.string().optional(),
        revisit_date: isoDate.optional(),
        next_step: z.string().optional(),
        next_step_date: isoDate.optional(),
      },
    },
    async (a) => {
      if (a.new_stage === "forlorad" && !a.lost_reason) return fail("Ange lost_reason när ett företag markeras som förlorat.");
      if (a.new_stage === "aterkom" && !a.revisit_date) return fail("Ange revisit_date för Återkom senare.");
      const act = await db.from("activities").insert({
        company_id: a.company_id,
        owner_id: ownerId,
        type: a.type,
        outcome: a.outcome ?? null,
        note: a.note ?? null,
        objection: a.objection ?? null,
        logged_by: CLAUDE_ACTOR,
        ...(a.occurred_at ? { occurred_at: a.occurred_at } : {}),
      });
      if (act.error) return dbFail(act.error);

      const patch: Record<string, unknown> = {};
      if (a.next_step !== undefined) patch.next_step = a.next_step;
      if (a.next_step_date !== undefined) patch.next_step_date = a.next_step_date;
      if (a.new_stage) {
        const current = await db.from("companies").select("stage").eq("id", a.company_id).maybeSingle();
        if (current.data && SIGNED_STAGES.includes(current.data.stage as Stage)) {
          return fail("Aktiviteten är loggad, men Claude får inte ändra steg för betalande företag.");
        }
        patch.stage = a.new_stage;
        if (a.new_stage === "forlorad") patch.lost_reason = a.lost_reason;
        if (a.new_stage === "aterkom") patch.revisit_date = a.revisit_date;
      }
      if (Object.keys(patch).length) {
        const upd = await db.from("companies").update(patch).eq("id", a.company_id);
        if (upd.error) return dbFail(upd.error);
      }
      // Samma regel som snabbloggen: ett uttryckligt nästa steg ersätter stegets automatiska påminnelse.
      if (a.next_step_date && a.new_stage !== "forlorad" && a.new_stage !== "aterkom") {
        if (a.new_stage !== "mote_bokat") {
          await db.from("tasks").update({ done: true }).eq("company_id", a.company_id).eq("done", false).not("auto_stage", "is", null);
        }
        const task = await db.from("tasks").insert({ company_id: a.company_id, owner_id: ownerId, title: a.next_step ?? "Följ upp", due_date: a.next_step_date });
        if (task.error) return dbFail(task.error);
      }
      return ok({ logged: true, stage: a.new_stage ? STAGE_LABELS[a.new_stage] : "oförändrat", next_step_date: a.next_step_date ?? null });
    },
  );

  server.registerTool(
    "crm_add_contact",
    {
      title: "Ny kontaktperson",
      description: "Add a work contact to a company. Only work email/phone – never private details.",
      inputSchema: {
        company_id: z.string().uuid(),
        name: z.string().min(1),
        role: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        preferred_channel: z.enum(CHANNELS).optional(),
        is_decision_maker: z.boolean().default(false),
      },
    },
    async (c) => {
      const { data, error } = await db.from("contacts").insert({ ...c, owner_id: ownerId }).select("id, name").single();
      if (error) return dbFail(error);
      return ok({ created: data });
    },
  );

  server.registerTool(
    "crm_list_tasks",
    {
      title: "Uppgifter",
      description: "List open tasks (follow-ups) up to a date, optionally for one company. Overdue tasks are included.",
      inputSchema: {
        until: isoDate.optional().describe("Defaults to 7 days from today"),
        company_id: z.string().uuid().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ until, company_id }) => {
      let q = db.from("tasks").select("id, title, due_date, auto_stage, companies(id, name)").eq("done", false).lte("due_date", until ?? addDays(today(), 7));
      if (company_id) q = q.eq("company_id", company_id);
      const { data, error } = await q.order("due_date");
      if (error) return dbFail(error);
      return ok({ today: today(), tasks: data });
    },
  );

  server.registerTool(
    "crm_create_task",
    {
      title: "Ny uppgift / påminnelse",
      description:
        "Create a follow-up task that shows up on the CRM's Today view on its due date. If the user wants a calendar reminder too, also create a Google Calendar event.",
      inputSchema: {
        title: z.string().min(1),
        due_date: isoDate,
        company_id: z.string().uuid().optional(),
      },
    },
    async (t) => {
      const { data, error } = await db.from("tasks").insert({ ...t, owner_id: ownerId }).select("id, title, due_date").single();
      if (error) return dbFail(error);
      return ok({ created: data });
    },
  );

  server.registerTool(
    "crm_complete_task",
    {
      title: "Klarmarkera uppgift",
      description: "Mark a task as done, or move it to a new date with postpone_to.",
      inputSchema: { task_id: z.string().uuid(), postpone_to: isoDate.optional() },
      annotations: { idempotentHint: true },
    },
    async ({ task_id, postpone_to }) => {
      const patch = postpone_to ? { due_date: postpone_to } : { done: true };
      const { data, error } = await db.from("tasks").update(patch).eq("id", task_id).select("id, title, due_date, done").maybeSingle();
      if (error) return dbFail(error);
      if (!data) return fail("Hittar ingen uppgift med det id:t.");
      return ok({ updated: data });
    },
  );

  // -------------------------------------------------------------------------
  // Färdiga arbetsflöden (prompts)
  // -------------------------------------------------------------------------

  server.registerPrompt(
    "morgonrutin",
    { title: "Morgonrutin", description: "Dagens möten, nya kundmejl, uppföljningar och mejlutkast." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Kör min morgonrutin för Collaktiv:
1. Hämta dagens läge med crm_today.
2. Läs dagens händelser i Google Kalender. Om en händelse har en gäst vars mejl matchar ett företag (crm_find_by_email) och företaget inte redan står i Möte bokat eller längre fram: flytta det till mote_bokat med crm_move_stage.
3. Sök i Gmail efter mejl från det senaste dygnet. För varje mejl till/från en adress som matchar ett företag: logga det med crm_log_activity (type "mejl") och föreslå nästa steg.
4. Skriv mejlutkast (Gmail-utkast, skicka ALDRIG) för de försenade uppföljningarna där vi har en mejladress och do_not_contact är false.
5. Ge mig en kort plan för dagen på svenska: möten, vilka jag ska ringa, vilka jag ska besöka (grupperat per område) och vilka utkast som väntar på mig.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "uppfoljningsmejl",
    {
      title: "Uppföljningsmejl",
      description: "Skriv ett personligt uppföljningsmejl som Gmail-utkast till ett företag.",
      argsSchema: { foretag: z.string().describe("Företagets namn") },
    },
    ({ foretag }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Hitta "${foretag}" med crm_search_companies och läs företagskortet med crm_get_company. Om do_not_contact är true: stanna och säg det.
Skriv sedan ett kort, personligt uppföljningsmejl på svenska utifrån historiken (vad vi pratat om, invändningar) och företagets kategori och läge.
Nämn att Collaktiv belönar bussresenärer i Gävleborg med poäng som löses in hos lokala företag, och erbjud Founding Partner-rabatten (−20 %) om det finns platser kvar.
Avsluta med en enkel fråga och ett sätt att tacka nej till fler mejl.
Spara som utkast i Gmail till kontaktpersonens jobbmejl – skicka inte. Sätt sedan nästa steg (om 3 dagar) med crm_update_company.`,
          },
        },
      ],
    }),
  );

  return server;
}
