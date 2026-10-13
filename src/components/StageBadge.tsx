import { STAGE_COLORS, STAGE_LABELS, type Stage } from "@/lib/constants";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-accent text-brand-dark" : score >= 40 ? "bg-accent-light text-brand" : "bg-line text-muted";
  return (
    <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1 text-xs font-bold ${color}`} title="Prioritetspoäng">
      {score}
    </span>
  );
}
