import { test } from "node:test";
import assert from "node:assert/strict";
import { daysInStage, isStale, needsAction, sortCompanies } from "./logic.ts";
import type { PipelineCompany } from "./types.ts";

const base: PipelineCompany = {
  id: "1", name: "A", stage: "dialog", priority_score: 50, category: null, municipality: null, network: null,
  next_step: null, next_step_date: null, stage_changed_at: "2026-10-01T10:00:00Z", last_contact_at: null,
  revisit_date: null, lost_reason: null, contact: null, contract: null, overdueTasks: 0, openTasks: 0,
};

test("daysInStage och isStale", () => {
  assert.equal(daysInStage(base, "2026-10-06"), 5);
  assert.equal(isStale(base, "2026-10-06"), false);
  assert.equal(isStale(base, "2026-10-08"), true); // dialog: 7 dagar
  assert.equal(isStale({ ...base, stage: "prospekt" }, "2027-01-01"), false);
});

test("needsAction", () => {
  assert.equal(needsAction(base, "2026-10-06"), false);
  assert.equal(needsAction({ ...base, overdueTasks: 1 }, "2026-10-06"), true);
  assert.equal(needsAction({ ...base, next_step_date: "2026-10-05" }, "2026-10-06"), true);
});

test("sortCompanies", () => {
  const list = [
    { ...base, id: "a", name: "Öst", priority_score: 10, next_step_date: "2026-10-09" },
    { ...base, id: "b", name: "Alfa", priority_score: 90 },
    { ...base, id: "c", name: "Beta", priority_score: 50, next_step_date: "2026-10-07" },
  ];
  assert.deepEqual(sortCompanies(list, "poang").map((c) => c.id), ["b", "c", "a"]);
  assert.deepEqual(sortCompanies(list, "nasta").map((c) => c.id), ["c", "a", "b"]);
  assert.deepEqual(sortCompanies(list, "namn").map((c) => c.id), ["b", "c", "a"]);
});
