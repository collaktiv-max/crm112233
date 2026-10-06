import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDate, today } from "@/lib/dates";
import { GOAL_PARTNERS, SIGNED_STAGES } from "@/lib/constants";
import { TaskItem } from "@/components/TaskItem";
import { ScoreBadge, StageBadge } from "@/components/StageBadge";
import type { Company, Task } from "@/lib/types";

type TaskWithCompany = Task & { companies: Pick<Company, "id" | "name"> | null };

export default async function TodayPage() {
  const supabase = await createClient();
  const t = today();

  const [tasksRes, meetingsRes, prospectsRes, revisitRes, signedRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, companies(id, name)")
      .eq("done", false)
      .lte("due_date", addDays(t, 7))
      .order("due_date")
      .returns<TaskWithCompany[]>(),
    supabase.from("companies").select("*").eq("stage", "mote_bokat").eq("next_step_date", t).returns<Company[]>(),
    supabase
      .from("companies")
      .select("*")
      .eq("stage", "prospekt")
      .is("unsubscribed_at", null)
      .order("priority_score", { ascending: false })
      .limit(15)
      .returns<Company[]>(),
    supabase.from("companies").select("*").eq("stage", "aterkom").lte("revisit_date", t).returns<Company[]>(),
    supabase.from("companies").select("id", { count: "exact", head: true }).in("stage", SIGNED_STAGES),
  ]);

  const tasks = tasksRes.data ?? [];
  const dueNow = tasks.filter((x) => x.due_date <= t);
  const upcoming = tasks.filter((x) => x.due_date > t);
  const meetings = meetingsRes.data ?? [];
  const daily = [...(revisitRes.data ?? []), ...(prospectsRes.data ?? [])];
  const signed = signedRes.count ?? 0;

  // Gruppera Dagens lista per område så att flera kan besökas i samma tur.
  const groups = new Map<string, Company[]>();
  for (const c of daily) {
    const area = c.network || c.municipality || "Okänt område";
    groups.set(area, [...(groups.get(area) ?? []), c]);
  }

  const weekday = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-gray-500">{weekday}</p>
          <h1 className="h1">Idag</h1>
        </div>
        <Link href="/dashboard" className="rounded-xl bg-accent-light px-3 py-2 text-right">
          <span className="block text-lg font-bold leading-none text-brand">
            {signed}/{GOAL_PARTNERS}
          </span>
          <span className="text-[10px] font-semibold uppercase text-brand">signerade</span>
        </Link>
      </header>

      {meetings.length > 0 && (
        <section>
          <h2 className="h2 mb-2">Möten idag</h2>
          <ul className="space-y-2">
            {meetings.map((c) => (
              <li key={c.id}>
                <Link href={`/foretag/${c.id}`} className="card flex items-center justify-between border-amber-300 bg-amber-50">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-gray-600">{c.next_step ?? "Genomgång"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="h2 mb-1">Att göra ({dueNow.length})</h2>
        {dueNow.length === 0 ? (
          <p className="card text-sm text-gray-500">Inga uppföljningar idag. Dags att besöka några prospekt! 🚌</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {dueNow.map((task) => (
              <TaskItem key={task.id} id={task.id} title={task.title} dueDate={task.due_date} done={task.done} company={task.companies} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="h2">Dagens lista</h2>
          <Link href="/foretag?steg=prospekt" className="text-xs font-semibold text-brand">
            Alla prospekt →
          </Link>
        </div>
        {daily.length === 0 ? (
          <p className="card text-sm text-gray-500">
            Inga prospekt ännu. <Link href="/import" className="font-semibold text-brand">Importera</Link> eller{" "}
            <Link href="/foretag/ny" className="font-semibold text-brand">lägg till</Link>.
          </p>
        ) : (
          <div className="space-y-4">
            {[...groups.entries()].map(([area, companies]) => (
              <div key={area}>
                <p className="mb-1 text-xs font-bold text-gray-700">📍 {area}</p>
                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
                  {companies.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                      {c.stage === "aterkom" ? <StageBadge stage={c.stage} /> : <ScoreBadge score={c.priority_score} />}
                      <Link href={`/foretag/${c.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {[c.category, c.address].filter(Boolean).join(" · ") || "–"}
                          {c.stage === "aterkom" && c.revisit_date && ` · återkom ${formatDate(c.revisit_date)}`}
                        </p>
                      </Link>
                      <Link href={`/logga?foretag=${c.id}`} className="rounded-lg bg-accent-light px-2 py-1 text-xs font-semibold text-brand">
                        Logga
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="h2 mb-1">Kommande 7 dagar</h2>
          <ul className="divide-y divide-gray-100">
            {upcoming.map((task) => (
              <TaskItem key={task.id} id={task.id} title={task.title} dueDate={task.due_date} done={task.done} company={task.companies} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
