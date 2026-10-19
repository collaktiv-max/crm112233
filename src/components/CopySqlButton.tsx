"use client";

import { useState } from "react";

export function CopySqlButton() {
  const [state, setState] = useState<"idle" | "copying" | "done" | "error">("idle");
  return (
    <button
      type="button"
      className="btn-primary w-full sm:w-auto"
      disabled={state === "copying"}
      onClick={async () => {
        setState("copying");
        try {
          const res = await fetch("/status/sql", { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          await navigator.clipboard.writeText(await res.text());
          setState("done");
        } catch {
          setState("error");
        }
      }}
    >
      {state === "done" ? "✓ Kopierad – klistra in i Supabase" : state === "error" ? "Gick inte att kopiera – försök igen" : "Kopiera reparations-SQL"}
    </button>
  );
}
