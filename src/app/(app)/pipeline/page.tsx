import { createClient } from "@/lib/supabase/server";
import { KanbanBoard, type KanbanCompany } from "@/components/KanbanBoard";

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, stage, priority_score, municipality, network, next_step_date")
    .returns<KanbanCompany[]>();
  const companies = data ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="h1">Pipeline</h1>
        <p className="text-sm text-gray-500">Dra kort mellan steg, eller tryck ⇄ på mobilen.</p>
      </header>
      {/* key: nytt serverdata → nytt lokalt state */}
      <KanbanBoard key={companies.map((c) => c.id + c.stage).join()} initial={companies} />
    </div>
  );
}
