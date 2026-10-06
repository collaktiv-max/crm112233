import { daysBetween, today } from "../../lib/dates.ts";
import { STALE_AFTER_DAYS, type PipelineCompany } from "./types.ts";

export function daysInStage(c: PipelineCompany, ref = today()): number {
  return Math.max(0, daysBetween(c.stage_changed_at.slice(0, 10), ref));
}

export function isStale(c: PipelineCompany, ref = today()): boolean {
  const limit = STALE_AFTER_DAYS[c.stage];
  return limit !== undefined && daysInStage(c, ref) >= limit;
}

/** Behöver något göras nu: försenad uppgift, passerat nästa steg eller stillastående. */
export function needsAction(c: PipelineCompany, ref = today()): boolean {
  return c.overdueTasks > 0 || (!!c.next_step_date && c.next_step_date < ref) || isStale(c, ref);
}

export type SortKey = "poang" | "nasta" | "dagar" | "namn";

export function sortCompanies(list: PipelineCompany[], key: SortKey, ref = today()): PipelineCompany[] {
  const copy = [...list];
  switch (key) {
    case "nasta":
      return copy.sort((a, b) => (a.next_step_date ?? "9999").localeCompare(b.next_step_date ?? "9999"));
    case "dagar":
      return copy.sort((a, b) => daysInStage(b, ref) - daysInStage(a, ref));
    case "namn":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    default:
      return copy.sort((a, b) => b.priority_score - a.priority_score || a.name.localeCompare(b.name, "sv"));
  }
}
