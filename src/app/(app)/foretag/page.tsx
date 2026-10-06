import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStage } from "@/lib/constants";
import { relativeDay } from "@/lib/dates";
import { FilterBar } from "@/components/FilterBar";
import { ScoreBadge, StageBadge } from "@/components/StageBadge";
import type { Company } from "@/lib/types";

type Search = { q?: string; steg?: string; kommun?: string; kategori?: string; natverk?: string; poang?: string };

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

  const { data, count } = await query
    .order("priority_score", { ascending: false })
    .order("name")
    .limit(300)
    .returns<Company[]>();
  const companies = data ?? [];

  return (
    <div className="space-y-4">
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

      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
        {companies.map((c) => (
          <li key={c.id}>
            <Link href={`/foretag/${c.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-gray-50">
              <ScoreBadge score={c.priority_score} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{c.name}</p>
                </div>
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
    </div>
  );
}
