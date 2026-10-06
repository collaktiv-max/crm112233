import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCompany } from "@/lib/actions";
import { CompanyForm } from "@/components/CompanyForm";
import { DeleteCompanyButton } from "@/components/DeleteCompanyButton";
import type { Company } from "@/lib/types";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("*").eq("id", id).maybeSingle<Company>();
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/foretag/${id}`} className="text-sm font-semibold text-brand">← {company.name}</Link>
      <h1 className="h1">Redigera</h1>
      <CompanyForm action={updateCompany.bind(null, id)} company={company} />
      <DeleteCompanyButton id={id} name={company.name} />
    </div>
  );
}
