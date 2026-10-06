import Link from "next/link";
import { createCompany } from "@/lib/actions";
import { CompanyForm } from "@/components/CompanyForm";

export default function NewCompanyPage() {
  return (
    <div className="space-y-4">
      <Link href="/foretag" className="text-sm font-semibold text-brand">← Företag</Link>
      <h1 className="h1">Nytt företag</h1>
      <CompanyForm action={createCompany} />
    </div>
  );
}
