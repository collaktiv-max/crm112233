import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHeaders, parseStage, toImportRows } from "./csv.ts";

test("mapHeaders känner igen svenska och engelska rubriker", () => {
  const m = mapHeaders(["Företag", "Kommun", "Kontaktperson", "E-post", "Okänd kolumn", "Org.nr"]);
  assert.equal(m["Företag"], "name");
  assert.equal(m["Kommun"], "municipality");
  assert.equal(m["Kontaktperson"], "contact_name");
  assert.equal(m["E-post"], "contact_email");
  assert.equal(m["Org.nr"], "org_nr");
  assert.equal(m["Okänd kolumn"], null);
});

test("parseStage tolkar etiketter och vardagliga ord", () => {
  assert.equal(parseStage("Möte bokat"), "mote_bokat");
  assert.equal(parseStage("betalande"), "betald");
  assert.equal(parseStage("Live"), "live");
  assert.equal(parseStage("Förlorad"), "forlorad");
  assert.equal(parseStage(""), null);
});

test("toImportRows bygger företag och kontakt, hoppar över rader utan namn", () => {
  let n = 0;
  const rows = toImportRows(
    [
      { Namn: "Kafé Ett", Kommun: "gävle", Kategori: "fika", Kontaktperson: "Anna", Mejl: "anna@ett.se", Steg: "" },
      { Namn: "", Kommun: "Gävle", Kategori: "", Kontaktperson: "", Mejl: "", Steg: "" },
      { Namn: "Butik Två", Kommun: "Sandviken", Kategori: "Mode", Kontaktperson: "", Mejl: "", Steg: "Dialog" },
    ],
    { defaultStage: "betald", defaultSource: "Befintlig partner", newId: () => `id${++n}` },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].company.municipality, "Gävle");
  assert.equal(rows[0].company.category, "Fika");
  assert.equal(rows[0].company.stage, "betald");
  assert.equal(rows[0].company.source, "Befintlig partner");
  assert.deepEqual(rows[0].contact?.email, "anna@ett.se");
  assert.equal(rows[1].company.stage, "dialog");
  assert.equal(rows[1].contact, null);
  assert.equal(rows[1].company.id, "id2");
});
