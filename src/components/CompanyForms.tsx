"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addContact,
  createTask,
  deleteContact,
  deleteContract,
  saveContract,
  toggleUnsubscribed,
  type ActionResult,
} from "@/lib/actions";
import { CHANNELS, CHANNEL_LABELS, PACKAGES, PACKAGE_LABELS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import type { Contract } from "@/lib/types";

/** Stänger/återställer formuläret när action lyckats. */
function useResetOnSuccess(state: ActionResult, onSuccess: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && "ok" in state) {
      ref.current?.reset();
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return ref;
}

function Toggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="text-sm font-semibold text-brand" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  return <div className="card mt-2 border-gray-300">{children(() => setOpen(false))}</div>;
}

export function AddContact({ companyId }: { companyId: string }) {
  return (
    <Toggle label="Kontaktperson">
      {(close) => <ContactForm companyId={companyId} close={close} />}
    </Toggle>
  );
}

function ContactForm({ companyId, close }: { companyId: string; close: () => void }) {
  const [state, action, pending] = useActionState(addContact, null);
  const ref = useResetOnSuccess(state, close);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="company_id" value={companyId} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" name="name" placeholder="Namn *" required autoFocus />
        <input className="input" name="role" placeholder="Roll" />
        <input className="input" name="phone" type="tel" placeholder="Jobbtelefon" />
        <input className="input" name="email" type="email" placeholder="Jobbmejl" />
      </div>
      <div className="flex items-center gap-3">
        <select className="input flex-1 py-2 text-sm" name="preferred_channel" defaultValue="" aria-label="Föredragen kanal">
          <option value="">Föredragen kanal</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_decision_maker" className="h-5 w-5 accent-brand" /> Beslutsfattare
        </label>
      </div>
      {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={close}>Avbryt</button>
        <button className="btn-primary flex-1" disabled={pending}>Spara</button>
      </div>
    </form>
  );
}

export function DeleteContactButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-gray-400 hover:text-red-600"
      onClick={() => confirm("Ta bort kontaktpersonen?") && start(() => deleteContact(id))}
    >
      Ta bort
    </button>
  );
}

export function ContractEditor({ companyId, contract }: { companyId: string; contract?: Contract }) {
  return (
    <Toggle label={contract ? "Redigera avtal" : "Avtal"}>
      {(close) => <ContractForm companyId={companyId} contract={contract} close={close} />}
    </Toggle>
  );
}

function ContractForm({ companyId, contract, close }: { companyId: string; contract?: Contract; close: () => void }) {
  const [state, action, pending] = useActionState(saveContract, null);
  const ref = useResetOnSuccess(state, close);
  const [del, startDel] = useTransition();
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="company_id" value={companyId} />
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <div className="grid grid-cols-2 gap-2">
        {PACKAGES.map((p) => (
          <label key={p} className="card flex items-center gap-2 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-accent-light">
            <input type="radio" name="package" value={p} defaultChecked={(contract?.package ?? "standard") === p} className="accent-brand" />
            {PACKAGE_LABELS[p]}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="founding_partner" defaultChecked={contract?.founding_partner} className="h-5 w-5 accent-brand" />
        Founding Partner (−20 %)
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Belopp betalt (kr)</label>
          <input className="input" name="amount_paid" inputMode="numeric" defaultValue={contract?.amount_paid ?? ""} />
        </div>
        <div>
          <label className="label">Betaldatum</label>
          <input className="input" name="paid_at" type="date" defaultValue={contract?.paid_at ?? ""} />
        </div>
        <div>
          <label className="label">Start (lansering)</label>
          <input className="input" name="start_date" type="date" defaultValue={contract?.start_date ?? ""} />
        </div>
        <div>
          <label className="label">Slut</label>
          <input className="input" name="end_date" type="date" defaultValue={contract?.end_date ?? ""} />
        </div>
      </div>
      <p className="text-xs text-gray-500">Betaldatum ifyllt flyttar företaget till Betald partner.</p>
      {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={close}>Avbryt</button>
        <button className="btn-primary flex-1" disabled={pending}>Spara avtal</button>
      </div>
      {contract && (
        <button
          type="button"
          className="w-full text-xs text-gray-400 hover:text-red-600"
          disabled={del}
          onClick={() => confirm("Ta bort avtalet?") && startDel(() => deleteContract(contract.id))}
        >
          Ta bort avtal
        </button>
      )}
    </form>
  );
}

export function AddTask({ companyId }: { companyId?: string }) {
  return (
    <Toggle label="Uppgift">
      {(close) => <TaskForm companyId={companyId} close={close} />}
    </Toggle>
  );
}

function TaskForm({ companyId, close }: { companyId?: string; close: () => void }) {
  const [state, action, pending] = useActionState(createTask, null);
  const ref = useResetOnSuccess(state, close);
  return (
    <form ref={ref} action={action} className="space-y-2">
      {companyId && <input type="hidden" name="company_id" value={companyId} />}
      <input className="input" name="title" placeholder="Vad?" required autoFocus />
      <input className="input" name="due_date" type="date" defaultValue={addDays(today(), 1)} required />
      {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={close}>Avbryt</button>
        <button className="btn-primary flex-1" disabled={pending}>Lägg till</button>
      </div>
    </form>
  );
}

export function UnsubscribeToggle({ companyId, unsubscribed }: { companyId: string; unsubscribed: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className={`flex items-center gap-2 text-sm ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        className="h-5 w-5 accent-brand"
        checked={unsubscribed}
        disabled={pending}
        onChange={(e) => start(() => toggleUnsubscribed(companyId, e.target.checked))}
      />
      Har tackat nej till utskick (avregistrerad)
    </label>
  );
}
