"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/login/actions";
import { NAV_ITEMS, NavIcon, PLUS_ICON, isActive } from "./nav";

/** Dator: fast sidomeny med sök, navigering och Logga-knapp. Döljs på mobil. */
export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" fokuserar sökfältet, "L" öppnar snabbloggen.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "l") {
        router.push("/logga");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-200 bg-gray-50/60 px-3 py-5 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="h-8 w-8 rounded-xl bg-brand" />
        <span className="text-lg font-bold tracking-tight">Collaktiv CRM</span>
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchRef.current?.value.trim() ?? "";
          router.push(q ? `/foretag?q=${encodeURIComponent(q)}` : "/foretag");
        }}
        className="mb-4"
      >
        <input ref={searchRef} type="search" placeholder="Sök företag…   /" className="input py-2 text-sm" />
      </form>

      <Link href="/logga" className="btn-primary mb-4 w-full">
        <NavIcon d={PLUS_ICON} className="h-5 w-5" strokeWidth={2.5} />
        Logga kontakt
      </Link>

      <nav>
        <ul className="space-y-1">
          {NAV_ITEMS.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive(pathname, it.href) ? "bg-accent-light text-brand" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <NavIcon d={it.icon} className="h-5 w-5" />
                {it.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/import"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive(pathname, "/import") ? "bg-accent-light text-brand" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <NavIcon d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" className="h-5 w-5" />
              Importera
            </Link>
          </li>
        </ul>
      </nav>

      <div className="mt-auto flex items-center justify-between rounded-xl px-3 py-2 text-sm">
        <span className="font-semibold text-gray-700">{userName}</span>
        <form action={signOut}>
          <button className="text-xs font-semibold text-gray-500 hover:text-gray-800">Logga ut</button>
        </form>
      </div>
      <p className="px-3 text-[11px] text-gray-400">Tips: tryck L för att logga, / för att söka</p>
    </aside>
  );
}
