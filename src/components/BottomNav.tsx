"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NavIcon, PLUS_ICON, isActive } from "./nav";

/** Mobil: bottenmeny med stor Logga-knapp i mitten. Döljs på dator. */
export function BottomNav() {
  const pathname = usePathname();
  const [a, b, c, d] = NAV_ITEMS;
  const item = (it: (typeof NAV_ITEMS)[number]) => (
    <li key={it.href}>
      <Link
        href={it.href}
        className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-semibold ${isActive(pathname, it.href) ? "text-brand" : "text-gray-500"}`}
      >
        <NavIcon d={it.icon} />
        {it.label}
      </Link>
    </li>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-3xl items-end justify-around px-2">
        {item(a)}
        {item(b)}
        <li className="-mt-5">
          <Link href="/logga" className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-white" aria-label="Snabblogga">
            <NavIcon d={PLUS_ICON} className="h-7 w-7" strokeWidth={2.5} />
          </Link>
        </li>
        {item(c)}
        {item(d)}
      </ul>
    </nav>
  );
}
