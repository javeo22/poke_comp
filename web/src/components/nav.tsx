"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/pokemon", label: "Pokedex" },
  { href: "/roster", label: "Roster" },
  { href: "/teams", label: "Teams" },
  { href: "/meta", label: "Meta" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-surface-high bg-surface-low px-6 py-3">
      <Link
        href="/"
        className="mr-6 font-display text-lg font-bold tracking-tight text-primary"
      >
        PCC
      </Link>
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-pill px-4 py-1.5 font-display text-xs uppercase tracking-wider transition-colors ${
              active
                ? "gradient-primary text-surface gloss-top"
                : "text-on-surface-muted hover:text-on-surface hover:bg-surface-mid"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
