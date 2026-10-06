"use client";

import { useActionState } from "react";
import { CATEGORIES, MUNICIPALITIES, NETWORKS, type Stage } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions";
import type { Company } from "@/lib/types";

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  company?: Company;
  defaultStage?: Stage;
};

export function CompanyForm({ action, company, defaultStage }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const isNew = !company;
  const chain = company?.is_chain === true ? "ja" : company?.is_chain === false ? "nej" : "";

  return (
    <form action={formAction} className="space-y-4">
      {isNew && <input type="hidden" name="stage" value={defaultStage ?? "prospekt"} />}
      <div>
        <label className="label" htmlFor="name">Namn *</label>
        <input className="input" id="name" name="name" required defaultValue={company?.name} autoFocus={isNew} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="category">Kategori</label>
          <select className="input" id="category" name="category" defaultValue={company?.category ?? ""}>
            <option value="">–</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="municipality">Kommun</label>
          <select className="input" id="municipality" name="municipality" defaultValue={company?.municipality ?? "Gävle"}>
            <option value="">–</option>
            {MUNICIPALITIES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="network">Nätverk / plats</label>
        <input className="input" id="network" name="network" list="networks" defaultValue={company?.network ?? ""} placeholder="t.ex. Gävle City, Valbo Köpcentrum" />
        <datalist id="networks">
          {NETWORKS.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>
      <div>
        <label className="label" htmlFor="address">Adress</label>
        <input className="input" id="address" name="address" defaultValue={company?.address ?? ""} />
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <label className="card flex items-center gap-2 p-3 text-sm">
          <input type="checkbox" name="near_transit" defaultChecked={company?.near_transit} className="h-5 w-5 accent-brand" />
          Nära hållplats
        </label>
        <div>
          <select className="input" name="is_chain" defaultValue={chain} aria-label="Kedja eller lokalt">
            <option value="">Kedja? Okänt</option>
            <option value="nej">Lokalt ägt</option>
            <option value="ja">Kedja</option>
          </select>
        </div>
      </fieldset>

      {isNew && (
        <fieldset className="card space-y-3">
          <legend className="label px-1">Kontaktperson (jobbuppgifter)</legend>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="contact_name" placeholder="Namn" />
            <input className="input" name="contact_role" placeholder="Roll" />
            <input className="input" name="contact_phone" type="tel" placeholder="Jobbtelefon" />
            <input className="input" name="contact_email" type="email" placeholder="Jobbmejl" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="contact_decision_maker" className="h-5 w-5 accent-brand" /> Beslutsfattare
          </label>
        </fieldset>
      )}

      <details className="card" open={!isNew}>
        <summary className="cursor-pointer text-sm font-semibold">Fler uppgifter</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="org_nr" placeholder="Org.nr" defaultValue={company?.org_nr ?? ""} />
            <input className="input" name="phone" type="tel" placeholder="Telefon (företag)" defaultValue={company?.phone ?? ""} />
            <input className="input" name="instagram" placeholder="Instagram" defaultValue={company?.instagram ?? ""} />
            <input className="input" name="facebook" placeholder="Facebook" defaultValue={company?.facebook ?? ""} />
          </div>
          <input className="input" name="website" type="url" placeholder="Webb (https://…)" defaultValue={company?.website ?? ""} />
          <input className="input" name="source" placeholder="Källa (t.ex. Gävle City-listan, tips från partner)" defaultValue={company?.source ?? ""} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_sole_trader" defaultChecked={company?.is_sole_trader} className="h-5 w-5 accent-brand" />
            Enskild firma (personuppgifter – var sparsam)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="next_step" placeholder="Nästa steg" defaultValue={company?.next_step ?? ""} />
            <input className="input" name="next_step_date" type="date" defaultValue={company?.next_step_date ?? ""} aria-label="Datum för nästa steg" />
          </div>
          <textarea className="input min-h-24" name="notes" placeholder="Anteckningar" defaultValue={company?.notes ?? ""} />
        </div>
      </details>

      {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Sparar…" : isNew ? "Skapa företag" : "Spara"}
      </button>
    </form>
  );
}
