"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { quickLog } from "@/lib/actions";
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  LOST_REASONS,
  MAIN_STAGES,
  OBJECTIONS,
  OUTCOMES,
  STAGE_LABELS,
  type ActivityType,
  type Stage,
} from "@/lib/constants";
import { addDays, today } from "@/lib/dates";

export type PickableCompany = { id: string; name: string; municipality: string | null; network: string | null; stage: Stage };

/** Föreslår nytt steg utifrån utfallet – går alltid att ändra. */
function suggestStage(current: Stage, outcome: string): Stage {
  const idx = MAIN_STAGES.indexOf(current);
  if (outcome === "Nej tack") return "forlorad";
  if (outcome === "Återkom senare") return "aterkom";
  if (outcome === "Positiv" || outcome === "Vill ha mer info") {
    return idx >= 0 && idx < MAIN_STAGES.indexOf("dialog") ? "dialog" : current;
  }
  if (current === "prospekt" || current === "aterkom") return "kontaktad";
  return current;
}

const DATE_CHIPS: [string, number][] = [
  ["Imorgon", 1],
  ["3 dagar", 3],
  ["1 vecka", 7],
  ["2 veckor", 14],
];

export function QuickLogForm({ companies, initialCompanyId }: { companies: PickableCompany[]; initialCompanyId?: string }) {
  const [state, action, pending] = useActionState(quickLog, null);
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ActivityType>("besok");
  const [outcome, setOutcome] = useState("");
  const [objection, setObjection] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [lostReason, setLostReason] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [revisitDate, setRevisitDate] = useState(addDays(today(), 30));

  const company = companies.find((c) => c.id === companyId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies.slice(0, 8);
    return companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [companies, search]);

  const effectiveStage: Stage | "" = stage || (company && outcome ? suggestStage(company.stage, outcome) : company?.stage ?? "");

  if (state && "ok" in state && company) {
    return (
      <div className="card space-y-4 text-center">
        <p className="text-4xl">✅</p>
        <p className="font-semibold">Loggat på {company.name}</p>
        <div className="flex gap-2">
          {/* Full omladdning ger ett helt tomt formulär. */}
          <a href="/logga" className="btn-secondary flex-1">Logga en till</a>
          <Link href={`/foretag/${company.id}`} className="btn-primary flex-1">Till företaget</Link>
        </div>
        <Link href="/" className="block text-sm font-semibold text-brand">Tillbaka till Idag</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="objection" value={objection} />
      <input type="hidden" name="stage" value={effectiveStage} />
      {effectiveStage === "forlorad" && <input type="hidden" name="lost_reason" value={lostReason} />}

      {/* 1. Företag */}
      <section>
        <p className="label">Företag</p>
        {company ? (
          <div className="card flex items-center justify-between p-3">
            <div>
              <p className="font-semibold">{company.name}</p>
              <p className="text-xs text-gray-500">{STAGE_LABELS[company.stage]} · {company.network ?? company.municipality ?? "–"}</p>
            </div>
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => { setCompanyId(""); setStage(""); }}>
              Byt
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input className="input" type="search" placeholder="Sök företag…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {matches.map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full items-center justify-between px-3 py-3 text-left active:bg-gray-50" onClick={() => setCompanyId(c.id)}>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.network ?? c.municipality}</span>
                  </button>
                </li>
              ))}
              <li>
                <Link href="/foretag/ny" className="block px-3 py-3 text-sm font-semibold text-brand">+ Nytt företag</Link>
              </li>
            </ul>
          </div>
        )}
      </section>

      {company && (
        <>
          {/* 2. Typ */}
          <section>
            <p className="label">Typ</p>
            <div className="grid grid-cols-4 gap-2">
              {ACTIVITY_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} className={`${type === t ? "chip-on" : "chip-off"} justify-center rounded-xl py-3`}>
                  {ACTIVITY_LABELS[t]}
                </button>
              ))}
            </div>
          </section>

          {/* 3. Utfall */}
          <section>
            <p className="label">Utfall</p>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <button key={o} type="button" onClick={() => { setOutcome(o === outcome ? "" : o); setStage(""); }} className={outcome === o ? "chip-on" : "chip-off"}>
                  {o}
                </button>
              ))}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-gray-500">Invändning?{objection && `: ${objection}`}</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {OBJECTIONS.map((o) => (
                  <button key={o} type="button" onClick={() => setObjection(o === objection ? "" : o)} className={objection === o ? "chip-on" : "chip-off"}>
                    {o}
                  </button>
                ))}
              </div>
            </details>
          </section>

          {/* 4. Steg */}
          <section>
            <p className="label">Steg</p>
            <div className="flex flex-wrap gap-2">
              {[...MAIN_STAGES, "aterkom" as const, "forlorad" as const].map((s) => (
                <button key={s} type="button" onClick={() => setStage(s)} className={`${effectiveStage === s ? "chip-on" : "chip-off"} py-1.5 text-xs`}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
            {effectiveStage === "forlorad" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="w-full text-xs font-semibold text-gray-500">Anledning *</span>
                {LOST_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setLostReason(r)} className={lostReason === r ? "chip-on" : "chip-off"}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            {effectiveStage === "aterkom" && (
              <div className="mt-3">
                <label className="label" htmlFor="revisit_date">Återkom datum *</label>
                <input className="input" id="revisit_date" name="revisit_date" type="date" value={revisitDate} onChange={(e) => setRevisitDate(e.target.value)} />
              </div>
            )}
          </section>

          {/* 5. Nästa steg */}
          {effectiveStage !== "forlorad" && effectiveStage !== "aterkom" && (
            <section>
              <p className="label">Nästa steg</p>
              <input className="input" name="next_step" placeholder={effectiveStage === "mote_bokat" ? "Möte: genomgång på plats" : "t.ex. Ring Anna, skicka info"} />
              <div className="mt-2 flex flex-wrap gap-2">
                {DATE_CHIPS.map(([label, days]) => {
                  const d = addDays(today(), days);
                  return (
                    <button key={label} type="button" onClick={() => setNextDate(nextDate === d ? "" : d)} className={nextDate === d ? "chip-on" : "chip-off"}>
                      {label}
                    </button>
                  );
                })}
                <input className="input w-auto flex-1 py-2" type="date" name="next_step_date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} aria-label="Datum för nästa steg" />
              </div>
            </section>
          )}

          <section>
            <textarea className="input min-h-20" name="note" placeholder="Anteckning (valfritt)" />
          </section>

          {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
          <button className="btn-primary sticky bottom-24 w-full lg:bottom-6 py-4 text-base shadow-lg" disabled={pending}>
            {pending ? "Sparar…" : "Spara"}
          </button>
        </>
      )}
    </form>
  );
}
