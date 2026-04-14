"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const closeMobile = () => setMobileOpen(false);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="border-b border-outline-variant bg-surface-low">
      {/* Desktop + mobile top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="mr-6 font-display text-lg font-bold tracking-tight text-primary"
          >
            PokeComp
          </Link>

          {/* Desktop nav links -- hidden on mobile */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-1">
                <span className="mr-1 font-display text-[0.5rem] uppercase tracking-widest text-on-surface-muted/50">
                  {group.label}
                </span>
                {group.links.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={pathname.startsWith(href)} />
                ))}
                <div className="mx-2 h-4 w-px bg-outline-variant/50" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auth buttons -- always visible */}
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <AuthButtons user={user} pathname={pathname} onSignOut={handleSignOut} />
          </div>

          {/* Hamburger button -- mobile only */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-surface-high transition-colors"
            aria-label="Toggle navigation"
          >
            <span
              className={`block h-0.5 w-5 bg-on-surface-muted transition-transform duration-200 ${
                mobileOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-on-surface-muted transition-opacity duration-200 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-on-surface-muted transition-transform duration-200 ${
                mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-outline-variant bg-surface-low px-6 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="mb-1.5 font-display text-[0.55rem] uppercase tracking-widest text-on-surface-muted/50">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.links.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={pathname.startsWith(href)} onClick={closeMobile} />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 flex items-center gap-2 border-t border-outline-variant pt-3 sm:hidden">
            <AuthButtons user={user} pathname={pathname} onSignOut={handleSignOut} onClick={closeMobile} />
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-wider transition-colors ${
        active
          ? "bg-primary text-surface"
          : "text-on-surface-muted hover:text-on-surface hover:bg-surface-high"
      }`}
    >
      {label}
    </Link>
  );
}

function AuthButtons({
  user,
  pathname,
  onSignOut,
  onClick,
}: {
  user: User | null;
  pathname: string;
  onSignOut: () => void;
  onClick?: () => void;
}) {
  if (user) {
    return (
      <>
        <NavLink href="/profile" label="Profile" active={pathname === "/profile"} onClick={onClick} />
        <button
          onClick={onSignOut}
          className="btn-ghost px-4 py-1.5 font-display text-xs uppercase tracking-wider hover:text-tertiary hover:border-tertiary/30"
        >
          Sign Out
        </button>
      </>
    );
  }
  return (
    <Link
      href="/login"
      className="btn-ghost px-4 py-1.5 font-display text-xs uppercase tracking-wider hover:text-primary hover:border-primary/30"
    >
      Sign In
    </Link>
  );
}
