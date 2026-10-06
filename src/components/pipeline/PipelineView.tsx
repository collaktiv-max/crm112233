"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { moveStage } from "@/lib/actions";
import {
  CATEGORIES,
  GOAL_PARTNERS,
  MAIN_STAGES,
  MUNICIPALITIES,
  SIGNED_STAGES,
  STAGE_DONE_WHEN,
  STAGE_LABELS,
  type Stage,
} from "@/lib/constants";
import { today } from "@/lib/dates";
import { isStale, needsAction, sortCompanies, type SortKey } from "./logic";
import { MoveSheet } from "./MoveSheet";
import { PipelineCard } from "./PipelineCard";
import type { PipelineCompany } from "./types";

const SIDE_TRACKS: Stage[] = ["aterkom", "forlorad"];
const COLUMN_LIMIT = 40;

type Filters = { q: string; kommun: string; natverk: string; kategori: string; action: boolean };

function matches(c: PipelineCompany, f: Filters, t: string) {
  if (f.q && !c.name.toLowerCase().includes(f.q.toLowerCase()) && !c.contact?.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.kommun && c.municipality !== f.kommun) return false;
  if (f.natverk && c.network !== f.natverk) return false;
  if (f.kategori && c.category !== f.kategori) return false;
  if (f.action && !needsAction(c, t)) return false;
  return true;
}

export function PipelineView({ initial, networks }: { initial: PipelineCompany[]; networks: string[] }) {
  const [companies, setCompanies] = useState(initial);
  // Nytt serverdata (efter flytt eller logg) ersätter det optimistiska läget men behåller filtren.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setCompanies(initial);
  }
  const [filters, setFilters] = useState<Filters>({ q: "", kommun: "", natverk: "", kategori: "", action: false });
  const [sort, setSort] = useState<SortKey>("poang");
  const [compact, setCompact] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileStage, setMobileStage] = useState<Stage>(() => {
    const active = MAIN_STAGES.slice(1, 5).find((s) => initial.some((c) => c.stage === s));
    return active ?? "prospekt";
  });
  const [expanded, setExpanded] = useState<Partial<Record<Stage, boolean>>>({});
  // Prospekt och Live är långa listor utan daglig rörelse – smala som standard på dator.
  const [collapsed, setCollapsed] = useState<Partial<Record<Stage, boolean>>>({ prospekt: true, live: true });
  const [showLost, setShowLost] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [moving, setMoving] = useState<{ company: PipelineCompany; sideTrack: "forlorad" | "aterkom" | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = today();

  const filtered = useMemo(() => companies.filter((c) => matches(c, filters, t)), [companies, filters, t]);
  const byStage = useMemo(() => {
    const map = new Map<Stage, PipelineCompany[]>();
    for (const s of [...MAIN_STAGES, ...SIDE_TRACKS]) map.set(s, []);
    for (const c of filtered) map.get(c.stage)?.push(c);
    for (const [s, list] of map) {
      map.set(s, s === "aterkom" ? [...list].sort((a, b) => (a.revisit_date ?? "").localeCompare(b.revisit_date ?? "")) : sortCompanies(list, sort, t));
    }
    return map;
  }, [filtered, sort, t]);

  const stats = useMemo(() => {
    const count = (stages: Stage[]) => companies.filter((c) => stages.includes(c.stage)).length;
    const contacted = companies.filter((c) => c.stage !== "prospekt").length;
    const signed = count([...SIGNED_STAGES]);
    return {
      active: count(["kontaktad", "dialog", "mote_bokat", "onboarding"]),
      close: count(["mote_bokat", "onboarding"]),
      signed,
      action: companies.filter((c) => !["forlorad", "live"].includes(c.stage) && needsAction(c, t)).length,
      conversion: contacted ? Math.round((signed / contacted) * 100) : 0,
      unpaid: companies.filter((c) => c.contract && !c.contract.paid).reduce((s, c) => s + (c.contract?.list_price ?? 0), 0),
    };
  }, [companies, t]);

  function move(company: PipelineCompany, stage: Stage, extra: { lost_reason?: string; revisit_date?: string } = {}) {
    if (company.stage === stage) return;
    if ((stage === "forlorad" || stage === "aterkom") && !extra.lost_reason && !extra.revisit_date) {
      setMoving({ company, sideTrack: stage });
      return;
    }
    const before = companies;
    setCompanies((cs) =>
      cs.map((c) =>
        c.id === company.id
          ? { ...c, stage, stage_changed_at: new Date().toISOString(), lost_reason: extra.lost_reason ?? c.lost_reason, revisit_date: extra.revisit_date ?? c.revisit_date }
          : c,
      ),
    );
    setError(null);
    start(async () => {
      const res = await moveStage(company.id, stage, extra);
      if (res && "error" in res) {
        setCompanies(before);
        setError(res.error);
      } else {
        setMoving(null);
      }
    });
  }

  const dropProps = (stage: Stage) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOverStage(stage);
    },
    onDragLeave: () => setOverStage((s) => (s === stage ? null : s)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOverStage(null);
      const c = companies.find((x) => x.id === dragId);
      if (c) move(c, stage);
      setDragId(null);
    },
  });

  const card = (c: PipelineCompany, desktop: boolean) => (
    <PipelineCard
      key={c.id}
      company={c}
      compact={compact}
      draggable={desktop}
      dragging={dragId === c.id}
      onDragStart={() => setDragId(c.id)}
      onDragEnd={() => setDragId(null)}
      onMove={() => setMoving({ company: c, sideTrack: null })}
    />
  );

  const filterCount = [filters.kommun, filters.natverk, filters.kategori].filter(Boolean).length + (filters.action ? 1 : 0);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const selectCls = "rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-accent/50";

  const filterSelects = (
    <>
      <select className={selectCls} value={filters.kommun} onChange={(e) => set("kommun", e.target.value)} aria-label="Kommun">
        <option value="">Alla kommuner</option>
        {MUNICIPALITIES.map((m) => <option key={m}>{m}</option>)}
      </select>
      <select className={selectCls} value={filters.natverk} onChange={(e) => set("natverk", e.target.value)} aria-label="Nätverk">
        <option value="">Alla nätverk</option>
        {networks.map((n) => <option key={n}>{n}</option>)}
      </select>
      <select className={selectCls} value={filters.kategori} onChange={(e) => set("kategori", e.target.value)} aria-label="Kategori">
        <option value="">Alla kategorier</option>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sortering">
        <option value="poang">Sortera: poäng</option>
        <option value="nasta">Sortera: nästa steg</option>
        <option value="dagar">Sortera: längst i steget</option>
        <option value="namn">Sortera: namn</option>
      </select>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Rubrik + nyckeltal */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="h1">Pipeline</h1>
            <p className="hidden text-sm text-gray-500 lg:block">Dra korten mellan stegen. Röd kant = försenad, gul = har stått still.</p>
          </div>
          <Link href="/foretag/ny" className="btn-primary hidden shrink-0 py-2 lg:inline-flex">+ Nytt företag</Link>
        </div>
        <div className="grid grid-cols-4 gap-2 lg:flex lg:gap-2">
          <Stat label="Signerade" value={`${stats.signed}/${GOAL_PARTNERS}`} accent />
          <Stat label="Aktiva" value={stats.active} />
          <Stat label="Nära affär" value={stats.close} />
          <Stat label="Åtgärda" value={stats.action} warn={stats.action > 0} onClick={() => set("action", !filters.action)} active={filters.action} />
          <Stat label="Konvertering" value={`${stats.conversion} %`} className="hidden lg:block" />
          <Stat label="Väntar på betalning" value={`${stats.unpaid.toLocaleString("sv-SE")} kr`} className="hidden lg:block" />
        </div>
      </header>

      {/* Verktygsrad */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1 py-2 text-sm lg:w-auto lg:min-w-56 lg:max-w-80"
          type="search"
          placeholder="Sök företag eller kontakt…"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
        />
        <button type="button" className="btn-secondary py-2 lg:hidden" onClick={() => setShowFilters((v) => !v)}>
          Filter{filterCount > 0 && ` (${filterCount})`}
        </button>
        <div className="hidden lg:contents">
          {filterSelects}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={filters.action} onChange={(e) => set("action", e.target.checked)} />
            Kräver åtgärd
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
            Kompakt
          </label>
        </div>
      </div>
      {showFilters && (
        <div className="grid grid-cols-2 gap-2 lg:hidden [&>select]:w-full">
          {filterSelects}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={filters.action} onChange={(e) => set("action", e.target.checked)} />
            Visa bara de som kräver åtgärd
          </label>
        </div>
      )}

      {error && !moving && <p className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {/* ---------------- Dator: hela tavlan ---------------- */}
      <div className="hidden lg:block">
        <div className="-mx-8 flex gap-3 overflow-x-auto px-8 pb-3">
          {MAIN_STAGES.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const visible = expanded[stage] ? items : items.slice(0, COLUMN_LIMIT);
            const staleCount = items.filter((c) => isStale(c, t)).length;
            if (collapsed[stage]) {
              return (
                <button
                  key={stage}
                  type="button"
                  {...dropProps(stage)}
                  onClick={() => setCollapsed((c) => ({ ...c, [stage]: false }))}
                  title={`Visa ${STAGE_LABELS[stage]}`}
                  className={`flex w-12 shrink-0 flex-col items-center gap-3 rounded-2xl py-3 transition hover:bg-gray-100 ${
                    overStage === stage ? "bg-accent-light ring-2 ring-accent" : "bg-gray-50"
                  }`}
                >
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm">{items.length}</span>
                  <span className="text-sm font-bold text-gray-700 [writing-mode:vertical-rl]">{STAGE_LABELS[stage]}</span>
                  <span className="mt-auto text-gray-400" aria-hidden>»</span>
                </button>
              );
            }
            return (
              <section
                key={stage}
                {...dropProps(stage)}
                className={`flex min-w-[200px] flex-1 basis-0 flex-col rounded-2xl transition ${
                  overStage === stage ? "bg-accent-light ring-2 ring-accent" : "bg-gray-50"
                }`}
              >
                <div className="sticky top-0 rounded-t-2xl px-3 pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold">{STAGE_LABELS[stage]}</h2>
                    <span className="flex items-center gap-1">
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm">{items.length}</span>
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [stage]: true }))}
                        className="rounded px-1 text-gray-400 hover:bg-white hover:text-gray-700"
                        title="Fäll ihop"
                        aria-label={`Fäll ihop ${STAGE_LABELS[stage]}`}
                      >
                        «
                      </button>
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500" title={STAGE_DONE_WHEN[stage]}>
                    {STAGE_DONE_WHEN[stage] ? `Klart när: ${STAGE_DONE_WHEN[stage].toLowerCase()}` : "Erbjudandet är live"}
                  </p>
                  {staleCount > 0 && <p className="mt-1 text-[11px] font-semibold text-amber-700">{staleCount} har stått still</p>}
                </div>
                <div className="flex max-h-[calc(100dvh-300px)] min-h-32 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {visible.map((c) => card(c, true))}
                  {items.length > visible.length && (
                    <button type="button" className="rounded-xl py-2 text-xs font-semibold text-brand hover:bg-white" onClick={() => setExpanded((e) => ({ ...e, [stage]: true }))}>
                      Visa alla {items.length}
                    </button>
                  )}
                  {items.length === 0 && <p className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">Släpp kort här</p>}
                </div>
              </section>
            );
          })}
        </div>

        {/* Sidospår */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {SIDE_TRACKS.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const open = stage === "aterkom" || showLost;
            return (
              <section
                key={stage}
                {...dropProps(stage)}
                className={`rounded-2xl p-3 transition ${overStage === stage ? "bg-accent-light ring-2 ring-accent" : stage === "aterkom" ? "bg-purple-50/60" : "bg-red-50/50"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold">
                    {STAGE_LABELS[stage]} <span className="font-normal text-gray-500">({items.length})</span>
                  </h2>
                  {stage === "forlorad" && (
                    <button type="button" className="text-xs font-semibold text-gray-600" onClick={() => setShowLost((v) => !v)}>
                      {showLost ? "Dölj" : "Visa"}
                    </button>
                  )}
                </div>
                {open ? (
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto xl:grid-cols-2">
                    {items.map((c) => card(c, true))}
                    {items.length === 0 && <p className="text-xs text-gray-400">Dra hit kort.</p>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Dra hit kort för att markera som förlorade.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* ---------------- Mobil: ett steg i taget ---------------- */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 py-2 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...MAIN_STAGES, ...SIDE_TRACKS].map((stage) => {
              const n = byStage.get(stage)?.length ?? 0;
              const warn = (byStage.get(stage) ?? []).some((c) => needsAction(c, t) && !["forlorad", "live"].includes(c.stage));
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setMobileStage(stage)}
                  className={`${mobileStage === stage ? "chip-on" : "chip-off"} shrink-0 gap-1.5 py-1.5 text-xs`}
                >
                  {STAGE_LABELS[stage]}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${mobileStage === stage ? "bg-white/20" : warn ? "bg-red-100 text-red-700" : "bg-gray-100"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        {STAGE_DONE_WHEN[mobileStage] && <p className="mb-2 text-xs text-gray-500">Klart när: {STAGE_DONE_WHEN[mobileStage].toLowerCase()}</p>}
        <div className="space-y-2">
          {(byStage.get(mobileStage) ?? []).slice(0, expanded[mobileStage] ? undefined : COLUMN_LIMIT).map((c) => card(c, false))}
          {(byStage.get(mobileStage)?.length ?? 0) > COLUMN_LIMIT && !expanded[mobileStage] && (
            <button type="button" className="btn-secondary w-full" onClick={() => setExpanded((e) => ({ ...e, [mobileStage]: true }))}>
              Visa alla {byStage.get(mobileStage)?.length}
            </button>
          )}
          {(byStage.get(mobileStage)?.length ?? 0) === 0 && <p className="card text-center text-sm text-gray-500">Inga företag i {STAGE_LABELS[mobileStage]}.</p>}
        </div>
      </div>

      {moving && (
        <MoveSheet
          company={moving.company}
          sideTrack={moving.sideTrack}
          pending={pending}
          error={error}
          onPick={(s) => move(moving.company, s)}
          onConfirmSideTrack={(extra) => moving.sideTrack && move(moving.company, moving.sideTrack, extra)}
          onClose={() => {
            setMoving(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
  active,
  className = "",
  onClick,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  warn?: boolean;
  active?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl border px-2 py-1.5 text-left lg:px-3 ${className} ${
        active ? "border-red-300 bg-red-50" : accent ? "border-transparent bg-accent-light" : "border-gray-200 bg-white"
      } ${onClick ? "hover:border-gray-300" : ""}`}
    >
      <p className={`text-base font-bold tabular-nums leading-tight lg:text-lg ${accent ? "text-brand" : warn ? "text-red-600" : ""}`}>{value}</p>
      <p className="truncate text-[10px] font-semibold text-gray-500 lg:overflow-visible lg:text-[11px]">{label}</p>
    </Tag>
  );
}
