import { createClient } from "@/lib/supabase/server";
import { QuickLogForm, type PickableCompany } from "@/components/QuickLogForm";

export default async function QuickLogPage({ searchParams }: { searchParams: Promise<{ foretag?: string }> }) {
  const { foretag } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, municipality, network, stage")
    .not("stage", "in", "(forlorad,live)")
    .order("last_contact_at", { ascending: false, nullsFirst: false })
    .order("priority_score", { ascending: false })
    .returns<PickableCompany[]>();
  let companies = data ?? [];

  // Företag som öppnas direkt (även förlorade/live) ska alltid gå att logga på.
  if (foretag && !companies.some((c) => c.id === foretag)) {
    const { data: one } = await supabase
      .from("companies")
      .select("id, name, municipality, network, stage")
      .eq("id", foretag)
      .maybeSingle<PickableCompany>();
    if (one) companies = [one, ...companies];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">Snabblogg</h1>
      <QuickLogForm companies={companies} initialCompanyId={foretag} />
    </div>
  );
}
