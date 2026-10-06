import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, relativeDay, today } from "./dates.ts";

test("today använder svensk tid", () => {
  // 23:30 UTC 31 dec = 00:30 1 jan i Stockholm
  assert.equal(today(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
});

test("addDays och daysBetween hanterar månadsskiften", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(daysBetween("2026-10-06", "2026-12-31"), 86);
});

test("relativeDay", () => {
  assert.equal(relativeDay("2026-10-06", "2026-10-06"), "idag");
  assert.equal(relativeDay("2026-10-07", "2026-10-06"), "imorgon");
  assert.equal(relativeDay("2026-10-09", "2026-10-06"), "om 3 dagar");
  assert.equal(relativeDay("2026-10-01", "2026-10-06"), "5 dagar sedan");
});
