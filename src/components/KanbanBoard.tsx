"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveStage } from "@/lib/actions";
import { MAIN_STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";
import { relativeDay } from "@/lib/dates";
import { SideTrackPrompt } from "./SideTrackPrompt";

export type KanbanCompany = {
  id: string;
  name: string;
  stage: Stage;
  priority_score: number;
  municipality: string | null;
  network: string | null;
  next_step_date: string | null;
};

const COLUMNS: Stage[] = [...MAIN_STAGES, "aterkom", "forlorad"];

export function KanbanBoard({ initial }: { initial: KanbanCompany[] }) {
  const [companies, setCompanies] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [picker, setPicker] = useState<KanbanCompany | null>(null);
  const [sideTrack, setSideTrack] = useState<{ id: string; stage: "forlorad" | "aterkom" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function move(id: string, stage: Stage, extra = {}) {
    const company = companies.find((c) => c.id === id);
    if (!company || company.stage === stage) return;
    if ((stage === "forlorad" || stage === "aterkom") && !("lost_reason" in extra || "revisit_date" in extra)) {
      setSideTrack({ id, stage });
      return;
    }
    const before = companies;
    setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    setError(null);
    start(async () => {
      const res = await moveStage(id, stage, extra);
      if (res && "error" in res) {
        setCompanies(before);
        setError(res.error);
      } else {
        setSideTrack(null);
      }
    });
  }

  return (
    <>
      {error && <p className="mb-2 rounded-xl bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
        {COLUMNS.map((stage) => {
          const items = companies
            .filter((c) => c.stage === stage)
            .sort((a, b) => b.priority_score - a.priority_score);
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                if (dragId) move(dragId, stage);
                setDragId(null);
              }}
              className={`flex w-64 shrink-0 snap-start flex-col rounded-2xl p-2 ${
                overStage === stage ? "bg-accent-light ring-2 ring-accent" : "bg-gray-50"
              }`}
            >
              <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-gray-600">
                {STAGE_LABELS[stage]}
                <span className="rounded-full bg-white px-2 py-0.5 text-gray-500">{items.length}</span>
              </h2>
              <ul className="max-h-[65dvh] min-h-16 space-y-2 overflow-y-auto">
                {items.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm ${dragId === c.id ? "opacity-40" : ""}`}
                  >
                    <Link href={`/foretag/${c.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {c.priority_score}p · {c.network ?? c.municipality ?? "–"}
                        {c.next_step_date && ` · ${relativeDay(c.next_step_date)}`}
                      </p>
                    </Link>
                    <button
                      type="button"
                      aria-label="Flytta"
                      className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100"
                      onClick={() => setPicker(c)}
                    >
                      ⇄
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {(picker || sideTrack) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => {
            setPicker(null);
            setSideTrack(null);
          }}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {sideTrack ? (
              <SideTrackPrompt
                stage={sideTrack.stage}
                pending={pending}
                error={error}
                onCancel={() => setSideTrack(null)}
                onConfirm={(extra) => move(sideTrack.id, sideTrack.stage, extra)}
              />
            ) : (
              picker && (
                <div className="card space-y-2 shadow-lg">
                  <p className="font-semibold">Flytta {picker.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMNS.filter((s) => s !== picker.stage).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="chip-off justify-center"
                        onClick={() => {
                          setPicker(null);
                          move(picker.id, s);
                        }}
                      >
                        {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
