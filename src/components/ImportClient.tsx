"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { importCompanies } from "@/lib/actions";
import { mapHeaders, toImportRows } from "@/lib/csv";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";

export function ImportClient() {
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [defaultStage, setDefaultStage] = useState<Stage>("betald");
  const [source, setSource] = useState("Befintlig partner");
  const [result, setResult] = useState<{ inserted: number; skipped: number; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const headers = records.length ? Object.keys(records[0]) : [];
  const mapping = mapHeaders(headers);
  const rows = useMemo(
    () => toImportRows(records, { defaultStage, defaultSource: source.trim() || null }),
    [records, defaultStage, source],
  );

  function onFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRecords(res.data),
    });
  }

  return (
    <div className="space-y-5">
      <label className="card flex cursor-pointer flex-col items-center gap-2 border-dashed py-8 text-center">
        <span className="text-3xl">📄</span>
        <span className="font-semibold">{fileName || "Välj CSV-fil"}</span>
        <span className="text-xs text-gray-500">Kolumner som namn, kommun, kategori, nätverk, kontaktperson, mejl, telefon, steg…</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {records.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Steg om kolumn saknas</label>
              <select className="input" value={defaultStage} onChange={(e) => setDefaultStage(e.target.value as Stage)}>
                {STAGES.filter((s) => s !== "forlorad" && s !== "aterkom").map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Källa</label>
              <input className="input" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
          </section>

          <section className="card text-sm">
            <h2 className="h2 mb-2">Kolumner</h2>
            <ul className="grid grid-cols-2 gap-1">
              {headers.map((h) => (
                <li key={h} className={mapping[h] ? "" : "text-gray-400"}>
                  {h} → {mapping[h] ?? "ignoreras"}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="h2 mb-2">Förhandsvisning ({rows.length} företag)</h2>
            <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-200 text-sm">
              {rows.slice(0, 100).map((r) => (
                <li key={r.company.id} className="flex justify-between gap-2 px-3 py-2">
                  <span className="truncate font-medium">{r.company.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {[r.company.municipality, STAGE_LABELS[r.company.stage], r.contact?.name].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <button
            className="btn-primary w-full"
            disabled={pending || rows.length === 0}
            onClick={() => start(async () => setResult(await importCompanies(rows)))}
          >
            {pending ? "Importerar…" : `Importera ${rows.length} företag`}
          </button>
        </>
      )}

      {result && (
        <div className={`card text-sm ${result.error ? "border-red-200 bg-red-50" : "border-brand/30 bg-accent-light/50"}`}>
          <p className="font-semibold">
            {result.inserted} importerade, {result.skipped} hoppades över (dubbletter eller utan namn).
          </p>
          {result.error && <p className="mt-1 text-red-700">{result.error}</p>}
          <Link href="/foretag" className="mt-2 inline-block font-semibold text-brand">Visa företag →</Link>
        </div>
      )}
    </div>
  );
}
