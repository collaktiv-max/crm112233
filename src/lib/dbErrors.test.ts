import { test } from "node:test";
import assert from "node:assert/strict";
import { explainDbError } from "./dbErrors.ts";

test("explainDbError känner igen de vanliga felen", () => {
  assert.equal(explainDbError(null), null);
  assert.match(explainDbError({ code: "42P01", message: 'relation "companies" does not exist' })!, /saknar tabeller/);
  assert.match(explainDbError({ code: "PGRST205", message: "Could not find the table 'public.companies'" })!, /saknar tabeller/);
  assert.match(explainDbError({ code: "42703", message: "column activities.logged_by does not exist" })!, /äldre version/);
  assert.match(explainDbError({ code: "42501", message: 'new row violates row-level security policy for table "companies"' })!, /behörighet/);
  assert.match(explainDbError({ message: "TypeError: fetch failed" })!, /når inte databasen/);
  assert.equal(explainDbError({ code: "23505", message: "duplicate key" }), "duplicate key");
});
