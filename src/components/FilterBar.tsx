"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, MUNICIPALITIES, NETWORKS, STAGES, STAGE_LABELS } from "@/lib/constants";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  // Sök med kort fördröjning medan man skriver.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => set("q", q.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const select = "input py-2 text-sm";
  return (
    <div className="space-y-2">
      <input className="input" type="search" placeholder="Sök företag…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select className={select} value={params.get("steg") ?? ""} onChange={(e) => set("steg", e.target.value)} aria-label="Steg">
          <option value="">Alla steg</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
        <select className={select} value={params.get("kommun") ?? ""} onChange={(e) => set("kommun", e.target.value)} aria-label="Kommun">
          <option value="">Alla kommuner</option>
          {MUNICIPALITIES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select className={select} value={params.get("kategori") ?? ""} onChange={(e) => set("kategori", e.target.value)} aria-label="Kategori">
          <option value="">Alla kategorier</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={select} value={params.get("natverk") ?? ""} onChange={(e) => set("natverk", e.target.value)} aria-label="Nätverk">
          <option value="">Alla nätverk</option>
          {NETWORKS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select className={select} value={params.get("poang") ?? ""} onChange={(e) => set("poang", e.target.value)} aria-label="Minsta poäng">
          <option value="">Alla poäng</option>
          <option value="70">70+ poäng</option>
          <option value="50">50+ poäng</option>
          <option value="30">30+ poäng</option>
        </select>
      </div>
    </div>
  );
}
