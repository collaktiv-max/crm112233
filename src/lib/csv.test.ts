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
  assert.deepEqual(rows[0].contacts[0]?.email, "anna@ett.se");
  assert.equal(rows[1].company.stage, "dialog");
  assert.deepEqual(rows[1].contacts, []);
  assert.equal(rows[1].company.id, "id2");
});

test("toImportRows slår ihop rader för samma företag och tar förlorade med anledning", () => {
  const rows = toImportRows(
    [
      { Namn: "Dios", Kommun: "Gävle", Kontaktperson: "Christina", Mejl: "c@dios.se", Steg: "Kontaktad", Anteckning: "Mejlat 15 okt", Förlustanledning: "" },
      { Namn: "dios", Kommun: "Gävle", Kontaktperson: "Jennie", Mejl: "j@dios.se", Steg: "Prospekt", Anteckning: "Kontakt sedan UF-året", Förlustanledning: "" },
      { Namn: "KappAhl", Kommun: "", Kontaktperson: "", Mejl: "", Steg: "Förlorad", Anteckning: "", Förlustanledning: "Har redan liknande" },
      { Namn: "Utan anledning", Kommun: "", Kontaktperson: "", Mejl: "", Steg: "Förlorad", Anteckning: "", Förlustanledning: "" },
    ],
    { defaultStage: "prospekt", defaultSource: null },
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].contacts.map((c) => c.name), ["Christina", "Jennie"]);
  assert.equal(rows[0].company.notes, "Mejlat 15 okt\nKontakt sedan UF-året");
  assert.equal(rows[0].company.stage, "kontaktad");
  assert.equal(rows[1].company.stage, "forlorad");
  assert.equal(rows[1].company.lost_reason, "Har redan liknande");
  assert.equal(rows[2].company.stage, "prospekt");
});

test("toImportRows behåller steget som kommit längst vid sammanslagning", () => {
  const rows = toImportRows(
    [
      { Namn: "Dios", Kommun: "Gävle", Steg: "Kontaktad" },
      { Namn: "Dios", Kommun: "Gävle", Steg: "Dialog" },
    ],
    { defaultStage: "prospekt", defaultSource: null },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company.stage, "dialog");
});
