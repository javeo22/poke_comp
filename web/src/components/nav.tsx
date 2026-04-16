"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { resetOnboardingTour } from "@/components/onboarding-tour";
import { PokeballLogo } from "@/components/pokeball-logo";
import { SupportPill } from "@/components/support-pill";
import { fetchProfile } from "@/lib/api";
import type { User } from "@supabase/supabase-js";

interface ProfileBrief {
  display_name: string | null;
  avatar_sprite_url: string | null;
  email: string | null;
}

const NAV_GROUPS: { label: string; links: { href: string; label: string }[]; dim?: boolean }[] = [
  {
    label: "Game Data",
    links: [
      { href: "/pokemon", label: "Pokedex" },
      { href: "/type-chart", label: "Types" },
    ],
  },
  {
    label: "Reference",
    dim: true,
    links: [
      { href: "/moves", label: "Moves" },
      { href: "/items", label: "Items" },
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
  const [profileBrief, setProfileBrief] = useState<ProfileBrief | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser);
      if (authUser) {
        fetchProfile()
          .then((fp) =>
            setProfileBrief({
              display_name: fp.profile.display_name,
              avatar_sprite_url: fp.profile.avatar_sprite_url,
              email: fp.email,
            })
          )
          .catch(() => {});
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (!newUser) {
        setProfileBrief(null);
      }
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
            className="mr-6 flex items-center gap-2 font-display text-lg font-bold tracking-tight text-primary"
          >
            <PokeballLogo className="h-5 w-5 shrink-0" />
            PokeComp
          </Link>
          <button
            onClick={resetOnboardingTour}
            className="mr-4 flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant text-[0.6rem] font-display text-on-surface-muted hover:text-primary hover:border-primary/30 transition-colors"
            title="Show feature tour"
          >
            ?
          </button>

          {/* Desktop nav links -- hidden on mobile */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-1">
                <span className={`mr-1 font-display text-[0.5rem] uppercase tracking-widest ${group.dim ? "text-on-surface-muted/30" : "text-on-surface-muted/50"}`}>
                  {group.label}
                </span>
                {group.links.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={pathname.startsWith(href)} dim={group.dim} />
                ))}
                <div className="mx-2 h-4 w-px bg-outline-variant/50" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Buy Me a Coffee pill -- desktop only (mobile shows in slide-down menu) */}
          <div className="hidden sm:block">
            <SupportPill />
          </div>

          {/* Auth buttons -- always visible */}
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <AuthButtons user={user} profileBrief={profileBrief} pathname={pathname} onSignOut={handleSignOut} />
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
              <p className={`mb-1.5 font-display text-[0.55rem] uppercase tracking-widest ${group.dim ? "text-on-surface-muted/30" : "text-on-surface-muted/50"}`}>
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.links.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={pathname.startsWith(href)} dim={group.dim} onClick={closeMobile} />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 flex items-center gap-2 border-t border-outline-variant pt-3 sm:hidden">
            <SupportPill onClick={closeMobile} />
            <AuthButtons user={user} profileBrief={profileBrief} pathname={pathname} onSignOut={handleSignOut} onClick={closeMobile} />
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
  dim,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  dim?: boolean;
  onClick?: () => void;
}) {
  const inactiveClass = dim
    ? "text-on-surface-muted/60 hover:text-on-surface-muted hover:bg-surface-high"
    : "text-on-surface-muted hover:text-on-surface hover:bg-surface-high";
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-wider transition-colors ${
        active ? "bg-primary text-surface" : inactiveClass
      }`}
    >
      {label}
    </Link>
  );
}

function AuthButtons({
  user,
  profileBrief,
  pathname,
  onSignOut,
  onClick,
}: {
  user: User | null;
  profileBrief: ProfileBrief | null;
  pathname: string;
  onSignOut: () => void;
  onClick?: () => void;
}) {
  if (user) {
    const displayName =
      profileBrief?.display_name ||
      profileBrief?.email?.split("@")[0] ||
      user.email?.split("@")[0] ||
      "Profile";

    return (
      <>
        <Link
          href="/profile"
          onClick={onClick}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
            pathname === "/profile"
              ? "bg-primary text-surface"
              : "hover:bg-surface-high"
          }`}
        >
          {/* Avatar */}
          {profileBrief?.avatar_sprite_url ? (
            <Image
              src={profileBrief.avatar_sprite_url}
              alt="Avatar"
              width={28}
              height={28}
              className="image-rendering-pixelated"
              unoptimized
            />
          ) : (
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-display font-bold ${
                pathname === "/profile"
                  ? "border-surface/30 text-surface"
                  : "border-outline-variant text-on-surface-muted"
              }`}
            >
              {displayName[0]?.toUpperCase()}
            </span>
          )}
          <span
            className={`font-display text-xs uppercase tracking-wider ${
              pathname === "/profile"
                ? "text-surface"
                : "text-on-surface-muted"
            }`}
          >
            {displayName.length > 12
              ? displayName.slice(0, 12) + "..."
              : displayName}
          </span>
        </Link>
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
