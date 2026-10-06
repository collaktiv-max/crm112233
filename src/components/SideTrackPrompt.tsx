"use client";

import { useState } from "react";
import { LOST_REASONS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";

type Props = {
  stage: "forlorad" | "aterkom";
  pending?: boolean;
  error?: string | null;
  onConfirm: (extra: { lost_reason?: string; revisit_date?: string }) => void;
  onCancel: () => void;
};

/** Frågar efter anledning (Förlorad) eller datum (Återkom senare). */
export function SideTrackPrompt({ stage, pending, error, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [date, setDate] = useState(addDays(today(), 30));
  const finalReason = reason === "Annat" ? other.trim() : reason;

  return (
    <div className="card space-y-3 border-gray-300 shadow-lg">
      {stage === "forlorad" ? (
        <>
          <p className="text-sm font-semibold">Varför förlorad?</p>
          <div className="flex flex-wrap gap-2">
            {LOST_REASONS.map((r) => (
              <button key={r} type="button" className={reason === r ? "chip-on" : "chip-off"} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          {reason === "Annat" && (
            <input className="input" placeholder="Anledning" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">När ska de dyka upp igen?</p>
          <div className="flex flex-wrap gap-2">
            {[
              ["2 veckor", 14],
              ["1 månad", 30],
              ["3 månader", 90],
            ].map(([label, days]) => (
              <button
                key={label}
                type="button"
                className={date === addDays(today(), days as number) ? "chip-on" : "chip-off"}
                onClick={() => setDate(addDays(today(), days as number))}
              >
                {label}
              </button>
            ))}
          </div>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Avbryt</button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={pending || (stage === "forlorad" ? !finalReason : !date)}
          onClick={() => onConfirm(stage === "forlorad" ? { lost_reason: finalReason } : { revisit_date: date })}
        >
          Spara
        </button>
      </div>
    </div>
  );
}
