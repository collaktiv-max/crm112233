"use client";

import { useState, useTransition } from "react";
import { moveStage } from "@/lib/actions";
import { MAIN_STAGES, STAGE_DONE_WHEN, STAGE_LABELS, type Stage } from "@/lib/constants";
import { SideTrackPrompt } from "./SideTrackPrompt";

export function StageMover({ companyId, stage }: { companyId: string; stage: Stage }) {
  const [pending, start] = useTransition();
  const [sideTrack, setSideTrack] = useState<"forlorad" | "aterkom" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentIndex = MAIN_STAGES.indexOf(stage);
  const next = currentIndex >= 0 && currentIndex < MAIN_STAGES.length - 1 ? MAIN_STAGES[currentIndex + 1] : null;

  function go(target: Stage, extra = {}) {
    setError(null);
    start(async () => {
      const res = await moveStage(companyId, target, extra);
      if (res && "error" in res) setError(res.error);
      else setSideTrack(null);
    });
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      <ol className="flex gap-1">
        {MAIN_STAGES.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              type="button"
              title={STAGE_LABELS[s]}
              onClick={() => s !== stage && go(s)}
              className={`h-2 w-full rounded-full ${
                s === stage ? "bg-brand" : currentIndex >= 0 && i < currentIndex ? "bg-accent" : "bg-gray-200"
              }`}
            />
          </li>
        ))}
      </ol>
      {next && (
        <div className="flex items-center gap-2">
          <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => go(next)}>
            → {STAGE_LABELS[next]}
          </button>
          {STAGE_DONE_WHEN[stage] && <p className="flex-1 text-xs text-gray-500">Klart när: {STAGE_DONE_WHEN[stage]}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          className="input w-auto flex-1 py-2 text-sm"
          value=""
          onChange={(e) => {
            const s = e.target.value as Stage;
            if (s === "forlorad" || s === "aterkom") setSideTrack(s);
            else if (s) go(s);
          }}
          aria-label="Flytta till steg"
        >
          <option value="">Flytta till…</option>
          {MAIN_STAGES.filter((s) => s !== stage).map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
          <option value="aterkom">Återkom senare</option>
          <option value="forlorad">Förlorad</option>
        </select>
      </div>
      {sideTrack && (
        <SideTrackPrompt stage={sideTrack} pending={pending} error={error} onCancel={() => setSideTrack(null)} onConfirm={(extra) => go(sideTrack, extra)} />
      )}
      {error && !sideTrack && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
