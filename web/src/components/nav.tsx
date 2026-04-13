"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const LINKS = [
  { href: "/pokemon", label: "Pokedex" },
  { href: "/roster", label: "Roster" },
  { href: "/teams", label: "Teams" },
  { href: "/meta", label: "Meta" },
  { href: "/moves", label: "Moves" },
  { href: "/items", label: "Items" },
  { href: "/type-chart", label: "Types" },
  { href: "/draft", label: "Draft" },
  { href: "/cheatsheet", label: "Cheatsheet" },
  { href: "/matches", label: "Matches" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="flex items-center justify-between border-b border-surface-high bg-surface-low px-6 py-3">
      <div className="flex items-center gap-1">
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
      </div>
      <div>
        {user ? (
          <button
            onClick={handleSignOut}
            className="rounded-pill px-4 py-1.5 font-display text-xs uppercase tracking-wider text-on-surface-muted hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
          >
            Sign Out
          </button>
        ) : (
          <Link
            href="/login"
            className="rounded-pill px-4 py-1.5 font-display text-xs uppercase tracking-wider text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 transition-colors border border-teal-500/30 hover:border-teal-400/50"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
