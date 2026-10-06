"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Idag", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/foretag", label: "Företag", icon: "M4 21V5a2 2 0 012-2h12a2 2 0 012 2v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M3 21h18" },
  { href: "/logga", label: "Logga", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/pipeline", label: "Pipeline", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z" },
  { href: "/dashboard", label: "Mål", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-end justify-around px-2">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          if (item.primary) {
            return (
              <li key={item.href} className="-mt-5">
                <Link
                  href={item.href}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-white"
                  aria-label="Snabblogga"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d={item.icon} />
                  </svg>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-semibold ${active ? "text-brand" : "text-gray-500"}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
