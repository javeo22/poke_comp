"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const NAV_GROUPS = [
  {
    label: "Game Data",
    links: [
      { href: "/pokemon", label: "Pokedex" },
      { href: "/moves", label: "Moves" },
      { href: "/items", label: "Items" },
      { href: "/type-chart", label: "Types" },
    ],
  },
  {
    label: "My Collection",
    links: [
      { href: "/roster", label: "Roster" },
      { href: "/teams", label: "Teams" },
    ],
  },
  {
    label: "Compete",
    links: [
      { href: "/meta", label: "Meta" },
      { href: "/draft", label: "Draft" },
      { href: "/cheatsheet", label: "Cheatsheet" },
      { href: "/matches", label: "Matches" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="flex items-center justify-between border-b border-outline-variant bg-surface-low px-6 py-3">
      <div className="flex items-center gap-1">
        <Link
          href="/"
          className="mr-6 font-display text-lg font-bold tracking-tight text-primary"
        >
          PokeComp
        </Link>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex items-center gap-1">
            <span className="mr-1 font-display text-[0.5rem] uppercase tracking-widest text-on-surface-muted/50">
              {group.label}
            </span>
            {group.links.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-primary text-surface"
                      : "text-on-surface-muted hover:text-on-surface hover:bg-surface-high"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="mx-2 h-4 w-px bg-outline-variant/50" />
          </div>
        ))}
      </div>
      <div>
        {user ? (
          <button
            onClick={handleSignOut}
            className="btn-ghost px-4 py-1.5 font-display text-xs uppercase tracking-wider hover:text-tertiary hover:border-tertiary/30"
          >
            Sign Out
          </button>
        ) : (
          <Link
            href="/login"
            className="btn-ghost px-4 py-1.5 font-display text-xs uppercase tracking-wider hover:text-primary hover:border-primary/30"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
