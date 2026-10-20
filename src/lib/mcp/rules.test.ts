import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_STAGES, companyDomain, secretMatches } from "./rules.ts";

test("Claude får inte sätta betalsteg", () => {
  assert.ok(!CLAUDE_STAGES.includes("betald"));
  assert.ok(!CLAUDE_STAGES.includes("live"));
  assert.ok(CLAUDE_STAGES.includes("mote_bokat"));
  assert.ok(CLAUDE_STAGES.includes("forlorad"));
});

test("companyDomain", () => {
  assert.equal(companyDomain("Anna@Kafe-Ett.se"), "kafe-ett.se");
  assert.equal(companyDomain("https://www.kafe-ett.se/meny"), "kafe-ett.se");
  assert.equal(companyDomain("kafe-ett.se"), "kafe-ett.se");
  assert.equal(companyDomain("anna@gmail.com"), null);
  assert.equal(companyDomain(""), null);
});

test("secretMatches kräver lång hemlighet och exakt träff", () => {
  const s = "a".repeat(32);
  assert.equal(secretMatches(s, s), true);
  assert.equal(secretMatches("b".repeat(32), s), false);
  assert.equal(secretMatches("kort", "kort"), false);
  assert.equal(secretMatches(null, s), false);
  assert.equal(secretMatches(s, undefined), false);
});
