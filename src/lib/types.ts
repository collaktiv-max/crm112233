import type { ActivityType, Channel, Package, Stage } from "./constants";

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  org_nr: string | null;
  category: string | null;
  municipality: string | null;
  network: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  phone: string | null;
  source: string | null;
  google_place_id: string | null;
  is_chain: boolean | null;
  is_sole_trader: boolean;
  near_transit: boolean;
  stage: Stage;
  stage_changed_at: string;
  priority_score: number;
  next_step: string | null;
  next_step_date: string | null;
  lost_reason: string | null;
  revisit_date: string | null;
  unsubscribed_at: string | null;
  last_contact_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: Channel | null;
  is_decision_maker: boolean;
  created_at: string;
};

export type Contract = {
  id: string;
  company_id: string;
  package: Package;
  founding_partner: boolean;
  list_price: number;
  amount_paid: number | null;
  paid_at: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  company_id: string;
  type: ActivityType;
  occurred_at: string;
  outcome: string | null;
  note: string | null;
  objection: string | null;
  logged_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  company_id: string | null;
  title: string;
  due_date: string;
  done: boolean;
  done_at: string | null;
  auto_stage: Stage | null;
  created_at: string;
};
