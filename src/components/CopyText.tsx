"use client";

import { useState } from "react";

export function CopyText({ text, label = "Kopiera" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary shrink-0 py-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* urklipp blockerat – texten går att markera manuellt */
        }
      }}
    >
      {copied ? "✓ Kopierad" : label}
    </button>
  );
}
