import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  FOUNDING_PARTNER_SLOTS,
  GOAL_DEADLINE,
  GOAL_PARTNERS,
  MAIN_STAGES,
  SIGNED_STAGES,
  STAGE_LABELS,
  type Stage,
} from "@/lib/constants";
import { addDays, daysBetween, personName, today } from "@/lib/dates";

type Row = { stage: Stage; lost_reason: string | null };
type ContractRow = { founding_partner: boolean; amount_paid: number | null; list_price: number; paid_at: string | null };
type ActivityRow = { type: string; objection: string | null; occurred_at: string; logged_by: string | null };

function Bars({ rows, max }: { rows: { label: string; value: number }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-sm" title={`${r.label}: ${r.value}`}>
          <span className="truncate text-gray-600">{r.label}</span>
          <span className="h-3 rounded-r bg-gray-100">
            {r.value > 0 && <span className="block h-3 rounded-r bg-brand" style={{ width: `${(r.value / top) * 100}%` }} />}
          </span>
          <span className="text-right font-semibold tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Tile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

const kr = (n: number) => `${n.toLocaleString("sv-SE")} kr`;

export default async function DashboardPage() {
  const supabase = await createClient();
  const t = today();
  const [companiesRes, contractsRes, activitiesRes] = await Promise.all([
    supabase.from("companies").select("stage, lost_reason").returns<Row[]>(),
    supabase.from("contracts").select("founding_partner, amount_paid, list_price, paid_at").returns<ContractRow[]>(),
    supabase.from("activities").select("type, objection, occurred_at, logged_by").gte("occurred_at", addDays(t, -7)).returns<ActivityRow[]>(),
  ]);
  const companies = companiesRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const activities = activitiesRes.data ?? [];

  const count = (s: Stage) => companies.filter((c) => c.stage === s).length;
  const signed = companies.filter((c) => SIGNED_STAGES.includes(c.stage)).length;
  const daysLeft = Math.max(0, daysBetween(t, GOAL_DEADLINE));
  const weeksLeft = Math.max(1, daysLeft / 7);
  const perWeek = Math.max(0, (GOAL_PARTNERS - signed) / weeksLeft);
  const paid = contracts.reduce((sum, k) => sum + (k.paid_at ? k.amount_paid ?? 0 : 0), 0);
  const unpaidValue = contracts.filter((k) => !k.paid_at).reduce((sum, k) => sum + k.list_price, 0);
  const foundingLeft = FOUNDING_PARTNER_SLOTS - contracts.filter((k) => k.founding_partner).length;
  const pct = Math.min(100, Math.round((signed / GOAL_PARTNERS) * 100));

  const lost = new Map<string, number>();
  for (const c of companies) if (c.stage === "forlorad") lost.set(c.lost_reason ?? "Okänd", (lost.get(c.lost_reason ?? "Okänd") ?? 0) + 1);
  const objections = new Map<string, number>();
  for (const a of activities) if (a.objection) objections.set(a.objection, (objections.get(a.objection) ?? 0) + 1);
  const perPerson = new Map<string, number>();
  for (const a of activities) {
    const who = personName(a.logged_by) || "Okänd";
    perPerson.set(who, (perPerson.get(who) ?? 0) + 1);
  }
  const byType = (type: string) => activities.filter((a) => a.type === type).length;

  return (
    <div className="space-y-6">
      <h1 className="h1">Mål</h1>

      <section className="card space-y-3 border-brand/30 bg-accent-light/40">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold tabular-nums text-brand">
              {signed}<span className="text-xl text-gray-500"> / {GOAL_PARTNERS}</span>
            </p>
            <p className="text-sm font-semibold text-gray-700">signerade och betalande partners</p>
          </div>
          <p className="text-right text-sm text-gray-600">
            <span className="block text-lg font-bold tabular-nums text-gray-900">{perWeek.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}/v</span>
            behövs · {daysLeft} dagar kvar
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={signed} aria-valuemax={GOAL_PARTNERS}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Tile value={kr(paid)} label="Intäkt (betalt)" sub={unpaidValue ? `${kr(unpaidValue)} väntar på betalning` : undefined} />
        <Tile value={`${foundingLeft}`} label="Founding Partner-platser kvar" sub={`av ${FOUNDING_PARTNER_SLOTS}`} />
        <Tile value={`${byType("besok")}`} label="Besök senaste 7 dagarna" sub={`${byType("samtal")} samtal · ${byType("mejl") + byType("dm")} mejl/DM`} />
        <Tile value={`${count("onboarding") + count("mote_bokat")}`} label="Nära affär" sub="Möte bokat + onboarding" />
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Pipeline</h2>
        <Bars rows={[...MAIN_STAGES, "aterkom" as const].map((s) => ({ label: STAGE_LABELS[s], value: count(s) }))} />
      </section>

      {perPerson.size > 1 && (
        <section className="card">
          <h2 className="h2 mb-3">Kontakter senaste 7 dagarna</h2>
          <Bars rows={[...perPerson.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
        </section>
      )}

      <section className="card">
        <h2 className="h2 mb-3">Förlust-anledningar</h2>
        {lost.size === 0 ? (
          <p className="text-sm text-gray-500">Inga förlorade ännu.</p>
        ) : (
          <Bars rows={[...lost.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
        )}
      </section>

      {objections.size > 0 && (
        <section className="card">
          <h2 className="h2 mb-3">Invändningar senaste 7 dagarna</h2>
          <Bars rows={[...objections.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Link href="/import" className="btn-secondary">Importera CSV</Link>
        <form action={signOut}>
          <button className="btn-secondary w-full text-gray-500">Logga ut</button>
        </form>
      </section>
    </div>
  );
}
