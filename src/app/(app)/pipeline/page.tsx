import { createClient } from "@/lib/supabase/server";
import { NETWORKS, type Package, type Stage } from "@/lib/constants";
import { today } from "@/lib/dates";
import { PipelineView } from "@/components/pipeline/PipelineView";
import type { PipelineCompany } from "@/components/pipeline/types";

type Row = Omit<PipelineCompany, "contact" | "contract" | "overdueTasks" | "openTasks"> & {
  contacts: { name: string; is_decision_maker: boolean }[];
  contracts: { package: Package; founding_partner: boolean; paid_at: string | null; list_price: number; created_at: string }[];
};

export default async function PipelinePage() {
  const supabase = await createClient();
  const t = today();

  const [companiesRes, tasksRes] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, stage, priority_score, category, municipality, network, next_step, next_step_date, stage_changed_at, last_contact_at, revisit_date, lost_reason, contacts(name, is_decision_maker), contracts(package, founding_partner, paid_at, list_price, created_at)",
      )
      .returns<Row[]>(),
    supabase.from("tasks").select("company_id, due_date").eq("done", false).not("company_id", "is", null).returns<{ company_id: string; due_date: string }[]>(),
  ]);

  const open = new Map<string, { open: number; overdue: number }>();
  for (const task of tasksRes.data ?? []) {
    const entry = open.get(task.company_id) ?? { open: 0, overdue: 0 };
    entry.open++;
    if (task.due_date < t) entry.overdue++;
    open.set(task.company_id, entry);
  }

  const companies: PipelineCompany[] = (companiesRes.data ?? []).map(({ contacts, contracts, ...c }) => {
    const contact = [...contacts].sort((a, b) => Number(b.is_decision_maker) - Number(a.is_decision_maker))[0] ?? null;
    const latest = [...contracts].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      ...c,
      stage: c.stage as Stage,
      contact,
      contract: latest
        ? { package: latest.package, founding_partner: latest.founding_partner, paid: !!latest.paid_at, list_price: latest.list_price }
        : null,
      openTasks: open.get(c.id)?.open ?? 0,
      overdueTasks: open.get(c.id)?.overdue ?? 0,
    };
  });

  const networks = [...new Set([...NETWORKS, ...companies.map((c) => c.network).filter((n): n is string => !!n)])].sort((a, b) =>
    a.localeCompare(b, "sv"),
  );

  return <PipelineView initial={companies} networks={networks} />;
}
