"use client";

import Link from "next/link";
import { ScoreBadge } from "@/components/StageBadge";
import { formatDate, relativeDay, today } from "@/lib/dates";
import { daysInStage, isStale } from "./logic";
import type { PipelineCompany } from "./types";

type Props = {
  company: PipelineCompany;
  compact?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onMove: () => void;
};

export function PipelineCard({ company: c, compact, draggable, dragging, onDragStart, onDragEnd, onMove }: Props) {
  const t = today();
  const days = daysInStage(c, t);
  const stale = isStale(c, t);
  const overdueStep = !!c.next_step_date && c.next_step_date < t;
  const area = c.network ?? c.municipality;

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
        dragging ? "opacity-40" : ""
      } ${c.overdueTasks > 0 || overdueStep ? "border-l-4 border-l-red-500 border-gray-200" : stale ? "border-l-4 border-l-amber-400 border-gray-200" : "border-gray-200"} ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <Link href={`/foretag/${c.id}`} className={`block ${compact ? "p-2" : "p-3"}`} draggable={false}>
        <div className="flex items-start gap-2 pr-24 lg:pr-0">
          <ScoreBadge score={c.priority_score} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
            {!compact && (
              <p className="truncate text-xs text-gray-500">{[c.category, area].filter(Boolean).join(" · ") || "–"}</p>
            )}
          </div>
        </div>

        {!compact && c.contact && (
          <p className="mt-2 truncate text-xs text-gray-700">
            👤 {c.contact.name}
            {c.contact.is_decision_maker && <span className="ml-1 font-semibold text-brand">· beslutar</span>}
          </p>
        )}

        {c.stage === "aterkom" && c.revisit_date ? (
          <p className="mt-1.5 truncate text-xs font-medium text-purple-700">↺ Återkom {relativeDay(c.revisit_date, t)}</p>
        ) : c.stage === "forlorad" && c.lost_reason ? (
          <p className="mt-1.5 truncate text-xs text-red-700">✕ {c.lost_reason}</p>
        ) : c.next_step || c.next_step_date ? (
          <p className={`mt-1.5 truncate text-xs ${overdueStep ? "font-semibold text-red-600" : "text-gray-700"}`}>
            → {c.next_step ?? "Nästa steg"}
            {c.next_step_date && <span className={overdueStep ? "" : "text-gray-500"}> · {relativeDay(c.next_step_date, t)}</span>}
          </p>
        ) : null}

        {!compact && (
          <p className="mt-1.5 truncate text-[11px] text-gray-500">
            {c.stage !== "prospekt" && (
              <span className={stale ? "font-semibold text-amber-700" : ""}>{days} d i steget</span>
            )}
            {c.stage !== "prospekt" && c.last_contact_at && " · "}
            {c.last_contact_at && <>kontakt {formatDate(c.last_contact_at)}</>}
          </p>
        )}
        {!compact && (c.overdueTasks > 0 || c.contract) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {c.overdueTasks > 0 && (
              <span className="rounded-md bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">{c.overdueTasks} försenad</span>
            )}
            {c.contract && (
              <span
                className={`rounded-md px-1.5 py-0.5 font-semibold ${c.contract.paid ? "bg-accent text-brand-dark" : "bg-orange-100 text-orange-800"}`}
              >
                {c.contract.package === "premium" ? "Premium" : "Standard"}
                {c.contract.founding_partner && " ★"}
                {!c.contract.paid && " · obetald"}
              </span>
            )}
          </div>
        )}
      </Link>

      <div className="absolute right-1.5 top-1.5 flex gap-1 rounded-lg lg:bottom-1.5 lg:top-auto lg:bg-white/90 lg:p-0.5 lg:opacity-0 lg:shadow-sm lg:group-hover:opacity-100 lg:focus-within:opacity-100">
        <Link
          href={`/logga?foretag=${c.id}`}
          className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-semibold text-brand hover:bg-accent"
          draggable={false}
        >
          Logga
        </Link>
        <button
          type="button"
          onClick={onMove}
          aria-label={`Flytta ${c.name}`}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          ⇄
        </button>
      </div>
    </article>
  );
}
