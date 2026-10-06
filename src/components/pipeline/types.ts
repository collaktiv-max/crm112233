import type { Package, Stage } from "../../lib/constants.ts";

export type PipelineCompany = {
  id: string;
  name: string;
  stage: Stage;
  priority_score: number;
  category: string | null;
  municipality: string | null;
  network: string | null;
  next_step: string | null;
  next_step_date: string | null;
  stage_changed_at: string;
  last_contact_at: string | null;
  revisit_date: string | null;
  lost_reason: string | null;
  contact: { name: string; is_decision_maker: boolean } | null;
  contract: { package: Package; founding_partner: boolean; paid: boolean; list_price: number } | null;
  overdueTasks: number;
  openTasks: number;
};

/** Antal dagar i ett steg innan kortet markeras som "har stått still". */
export const STALE_AFTER_DAYS: Partial<Record<Stage, number>> = {
  kontaktad: 4,
  dialog: 7,
  mote_bokat: 10,
  onboarding: 3,
  betald: 45,
};
