import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStage } from "@/lib/constants";
import { formatDate, relativeDay, today } from "@/lib/dates";
import { FilterBar } from "@/components/FilterBar";
import { ScoreBadge, StageBadge } from "@/components/StageBadge";
import type { Company } from "@/lib/types";

type Search = { q?: string; steg?: string; kommun?: string; kategori?: string; natverk?: string; poang?: string; sort?: string };

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  poang: { column: "priority_score", ascending: false },
  namn: { column: "name", ascending: true },
  nasta: { column: "next_step_date", ascending: true },
  kontakt: { column: "last_contact_at", ascending: false },
  steg: { column: "stage", ascending: true },
};

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("companies").select("*", { count: "exact" });
  if (sp.q) query = query.ilike("name", `%${sp.q.replace(/[%_,()]/g, "")}%`);
  if (isStage(sp.steg)) query = query.eq("stage", sp.steg);
  if (sp.kommun) query = query.eq("municipality", sp.kommun);
  if (sp.kategori) query = query.eq("category", sp.kategori);
  if (sp.natverk) query = query.eq("network", sp.natverk);
  if (sp.poang && Number(sp.poang) > 0) query = query.gte("priority_score", Number(sp.poang));

  const sort = SORTS[sp.sort ?? ""] ?? SORTS.poang;
  const { data, count } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("name")
    .limit(300)
    .returns<Company[]>();
  const companies = data ?? [];
  const t = today();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="h1">Företag</h1>
        <div className="flex gap-2">
          <Link href="/import" className="btn-secondary py-2">Importera</Link>
          <Link href="/foretag/ny" className="btn-primary py-2">+ Nytt</Link>
        </div>
      </header>

      <Suspense>
        <FilterBar />
      </Suspense>

      <p className="text-xs text-gray-500">{count ?? 0} företag</p>

      {/* Mobil: lista */}
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 lg:hidden">
        {companies.map((c) => (
          <li key={c.id}>
            <Link href={`/foretag/${c.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-gray-50">
              <ScoreBadge score={c.priority_score} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {[c.category, c.network ?? c.municipality].filter(Boolean).join(" · ") || "–"}
                  {c.next_step_date && ` · ${c.next_step ?? "Nästa steg"} ${relativeDay(c.next_step_date)}`}
                </p>
              </div>
              <StageBadge stage={c.stage} />
            </Link>
          </li>
        ))}
        {companies.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Inga företag matchar.</li>}
      </ul>

      {/* Dator: tabell */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortTh sp={sp} sortKey="poang" className="w-16">Poäng</SortTh>
              <SortTh sp={sp} sortKey="namn">Företag</SortTh>
              <SortTh sp={sp} sortKey="steg">Steg</SortTh>
              <th className="px-3 py-2.5">Område</th>
              <SortTh sp={sp} sortKey="nasta">Nästa steg</SortTh>
              <SortTh sp={sp} sortKey="kontakt">Senaste kontakt</SortTh>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.map((c) => {
              const late = !!c.next_step_date && c.next_step_date < t;
              return (
                <tr key={c.id} className="group hover:bg-gray-50">
                  <td className="px-3 py-2.5"><ScoreBadge score={c.priority_score} /></td>
                  <td className="max-w-72 px-3 py-2.5">
                    <Link href={`/foretag/${c.id}`} className="block truncate font-semibold hover:text-brand">{c.name}</Link>
                    <span className="block truncate text-xs text-gray-500">{c.category ?? "–"}</span>
                  </td>
                  <td className="px-3 py-2.5"><StageBadge stage={c.stage} /></td>
                  <td className="max-w-48 truncate px-3 py-2.5 text-gray-600">{c.network ?? c.municipality ?? "–"}</td>
                  <td className="max-w-64 px-3 py-2.5">
                    {c.next_step_date || c.next_step ? (
                      <>
                        <span className="block truncate">{c.next_step ?? "Nästa steg"}</span>
                        {c.next_step_date && (
                          <span className={`text-xs ${late ? "font-semibold text-red-600" : "text-gray-500"}`}>{relativeDay(c.next_step_date, t)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{c.last_contact_at ? formatDate(c.last_contact_at) : "–"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/logga?foretag=${c.id}`} className="rounded-lg bg-accent-light px-2 py-1 text-xs font-semibold text-brand opacity-0 group-hover:opacity-100 focus:opacity-100">
                      Logga
                    </Link>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">Inga företag matchar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortTh({ sp, sortKey, className = "", children }: { sp: Search; sortKey: string; className?: string; children: React.ReactNode }) {
  const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  params.set("sort", sortKey);
  const active = (sp.sort ?? "poang") === sortKey;
  return (
    <th className={`whitespace-nowrap px-3 py-2.5 ${className}`}>
      <Link href={`/foretag?${params}`} className={active ? "text-brand" : "hover:text-gray-800"}>
        {children}
        {active && " ↓"}
      </Link>
    </th>
  );
}
