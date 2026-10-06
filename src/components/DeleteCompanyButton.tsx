"use client";

import { useTransition } from "react";
import { deleteCompany } from "@/lib/actions";

export function DeleteCompanyButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-danger w-full"
      disabled={pending}
      onClick={() => {
        if (confirm(`Radera ${name} med all historik? Det går inte att ångra.`)) start(() => deleteCompany(id));
      }}
    >
      Radera företaget (GDPR)
    </button>
  );
}
