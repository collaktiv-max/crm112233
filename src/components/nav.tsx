export type NavItem = { href: string; label: string; icon: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Idag", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/foretag", label: "Företag", icon: "M4 21V5a2 2 0 012-2h12a2 2 0 012 2v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M3 21h18" },
  { href: "/pipeline", label: "Pipeline", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z" },
  { href: "/dashboard", label: "Mål", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z" },
];

export const PLUS_ICON = "M12 5v14M5 12h14";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavIcon({ d, className = "h-6 w-6", strokeWidth = 1.8 }: { d: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
