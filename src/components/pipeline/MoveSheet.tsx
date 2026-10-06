"use client";

import { MAIN_STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";
import { SideTrackPrompt } from "@/components/SideTrackPrompt";
import type { PipelineCompany } from "./types";

type Props = {
  company: PipelineCompany;
  sideTrack: "forlorad" | "aterkom" | null;
  pending: boolean;
  error: string | null;
  onPick: (stage: Stage) => void;
  onConfirmSideTrack: (extra: { lost_reason?: string; revisit_date?: string }) => void;
  onClose: () => void;
};

/** Bottenark på mobil, centrerad dialog på dator. */
export function MoveSheet({ company, sideTrack, pending, error, onPick, onConfirmSideTrack, onClose }: Props) {
  const idx = MAIN_STAGES.indexOf(company.stage);
  const next = idx >= 0 && idx < MAIN_STAGES.length - 1 ? MAIN_STAGES[idx + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Flytta ${company.name}`}
      >
        {sideTrack ? (
          <SideTrackPrompt stage={sideTrack} pending={pending} error={error} onCancel={onClose} onConfirm={onConfirmSideTrack} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Flytta {company.name}</p>
              <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500">Stäng</button>
            </div>
            {next && (
              <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => onPick(next)}>
                → {STAGE_LABELS[next]}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {MAIN_STAGES.filter((s) => s !== company.stage && s !== next).map((s) => (
                <button key={s} type="button" className="chip-off justify-center" disabled={pending} onClick={() => onPick(s)}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
              {company.stage !== "aterkom" && (
                <button type="button" className="chip justify-center border-purple-200 bg-purple-50 text-purple-800" onClick={() => onPick("aterkom")}>
                  Återkom senare
                </button>
              )}
              {company.stage !== "forlorad" && (
                <button type="button" className="chip justify-center border-red-200 bg-red-50 text-red-800" onClick={() => onPick("forlorad")}>
                  Förlorad
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
