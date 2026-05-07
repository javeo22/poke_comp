"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { resetOnboardingTour } from "@/components/onboarding-tour";
import { SupportPill } from "@/components/support-pill";
import { fetchProfile } from "@/lib/api";
import { PcMark } from "@/components/pc-mark";
import type { User } from "@supabase/supabase-js";

interface ProfileBrief {
  display_name: string | null;
  avatar_sprite_url: string | null;
  email: string | null;
}

const HOME_LINK = { href: "/", label: "Home", match: (p: string) => p === "/" } as const;

const NAV_GROUPS = [
  {
    label: "Build",
    links: [
      { href: "/pokemon", label: "Pokedex", match: (p: string) => p.startsWith("/pokemon") },
      { href: "/roster", label: "Roster", match: (p: string) => p === "/roster" },
      { href: "/teams", label: "Teams", match: (p: string) => p.startsWith("/teams") },
    ],
  },
  {
    label: "Prep",
    links: [
      { href: "/draft", label: "Draft", match: (p: string) => p.startsWith("/draft") },
      { href: "/cheatsheet", label: "Cheatsheet", match: (p: string) => p.startsWith("/cheatsheet") },
      { href: "/meta", label: "Meta", match: (p: string) => p.startsWith("/meta") },
      { href: "/speed-tiers", label: "Speed", match: (p: string) => p.startsWith("/speed-tiers") },
    ],
  },
  {
    label: "Battle",
    links: [
      { href: "/calc", label: "Calc", match: (p: string) => p.startsWith("/calc") },
      { href: "/type-chart", label: "Types", match: (p: string) => p.startsWith("/type-chart") },
    ],
  },
  {
    label: "Review",
    links: [
      { href: "/matches", label: "Matches", match: (p: string) => p.startsWith("/matches") },
    ],
  },
] as const;

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
    <nav className="relative z-20 border-b-2 border-outline-variant bg-surface shadow-[0_2px_0_var(--color-outline-variant)]">
      <div className="hidden items-center justify-between bg-on-surface px-6 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.22em] text-surface sm:flex lg:px-9">
        <span>
          <span className="text-primary">●</span> Live prep · Champions companion
        </span>
        <span className="text-accent">Usage, roster, draft, cheatsheet</span>
      </div>

      <div className="flex items-center justify-between px-6 py-3 lg:px-9">
        {/* LEFT: logo + tour reset */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-[1rem] font-bold uppercase tracking-[0.08em] text-on-surface">
                PokeComp
              </div>
              <div className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.22em] text-on-surface-muted">
                Companion · S1
              </div>
            </div>
          </Link>
          <button
            onClick={resetOnboardingTour}
            className="ml-1 hidden h-6 w-6 items-center justify-center rounded-[2px] border-2 border-outline-variant bg-surface-lowest text-[0.6rem] font-mono text-on-surface-muted transition-colors hover:bg-accent hover:text-on-surface sm:flex"
            title="Show feature tour"
          >
            ?
          </button>
        </div>

        {/* CENTER: primary links (desktop) */}
        <div className="hidden lg:flex items-center gap-7 text-[0.85rem]">
          <Link
            href={HOME_LINK.href}
            className={`relative px-3 py-2 font-display text-xs uppercase tracking-[0.12em] transition-colors ${
              HOME_LINK.match(pathname)
                ? "bg-on-surface text-surface shadow-[inset_3px_0_0_var(--color-primary)]"
                : "text-on-surface hover:bg-surface-high"
            }`}
          >
            {HOME_LINK.label}
          </Link>
          {NAV_GROUPS.map((group) => {
            const active = group.links.some((link) => link.match(pathname));
            return (
              <div key={group.label} className="group relative">
                <button
                  type="button"
                  className={`relative px-3 py-2 font-display text-xs uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? "bg-on-surface text-surface shadow-[inset_3px_0_0_var(--color-primary)]"
                      : "text-on-surface hover:bg-surface-high"
                  }`}
                >
                  {group.label}
                </button>
                <div className="invisible absolute left-1/2 top-full z-30 mt-3 min-w-44 -translate-x-1/2 rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-2 opacity-0 shadow-[4px_4px_0_var(--color-outline-variant)] transition-all group-hover:visible group-hover:opacity-100">
                  {group.links.map((link) => {
                    const linkActive = link.match(pathname);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block rounded-[2px] px-3 py-2 font-display text-xs uppercase tracking-[0.1em] transition-colors ${
                          linkActive
                            ? "bg-on-surface text-surface shadow-[inset_3px_0_0_var(--color-primary)]"
                            : "text-on-surface hover:bg-surface-high"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: potion + auth */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SupportPill />
          </div>
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <AuthButtons
              user={user}
              profileBrief={profileBrief}
              pathname={pathname}
              onSignOut={handleSignOut}
            />
          </div>

          {/* Hamburger -- mobile only */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex flex-col gap-1 rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-2 transition-colors hover:bg-surface-high lg:hidden"
            aria-label="Toggle navigation"
          >
            <span
              className={`block h-0.5 w-5 bg-on-surface transition-transform duration-200 ${
                mobileOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-on-surface transition-opacity duration-200 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-on-surface transition-transform duration-200 ${
                mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* MOBILE menu */}
      {mobileOpen && (
        <div className="border-t-2 border-outline-variant bg-surface px-6 pb-5 pt-3 lg:hidden">
          <div className="flex flex-col gap-1">
            <Link
              href={HOME_LINK.href}
              onClick={closeMobile}
              className={`rounded-[2px] px-3 py-2 font-display text-xs uppercase tracking-[0.12em] transition-colors ${
                HOME_LINK.match(pathname)
                  ? "bg-on-surface text-surface shadow-[inset_3px_0_0_var(--color-primary)]"
                  : "text-on-surface hover:bg-surface-high"
              }`}
            >
              {HOME_LINK.label}
            </Link>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="pt-2">
                <div className="px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-primary">
                  {group.label}
                </div>
                {group.links.map((link) => {
                  const active = link.match(pathname);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobile}
                      className={`block rounded-[2px] px-3 py-2 font-display text-xs uppercase tracking-[0.12em] transition-colors ${
                        active
                          ? "bg-on-surface text-surface shadow-[inset_3px_0_0_var(--color-primary)]"
                          : "text-on-surface hover:bg-surface-high"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t-2 border-outline-variant pt-4 sm:hidden">
            <SupportPill onClick={closeMobile} />
            <AuthButtons
              user={user}
              profileBrief={profileBrief}
              pathname={pathname}
              onSignOut={handleSignOut}
              onClick={closeMobile}
            />
          </div>
        </div>
      )}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="grid h-9 w-12 shrink-0 place-items-center rounded-[2px] border-2 border-outline-variant bg-surface-lowest text-primary shadow-[3px_3px_0_var(--color-outline-variant)]">
      <PcMark size={34} />
    </div>
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
          className={`flex items-center gap-2 rounded-[2px] border-2 px-2.5 py-1.5 transition-colors ${
            pathname === "/profile"
              ? "border-outline-variant bg-on-surface text-surface"
              : "border-transparent hover:border-outline-variant hover:bg-surface-high"
          }`}
        >
          {profileBrief?.avatar_sprite_url ? (
            <Image
              src={profileBrief.avatar_sprite_url}
              alt="Avatar"
              width={26}
              height={26}
              className="image-rendering-pixelated"
              unoptimized
            />
          ) : (
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem] font-display font-bold ${
                pathname === "/profile"
                  ? "border-surface text-surface"
                  : "border-outline-variant text-on-surface-muted"
              }`}
            >
              {displayName[0]?.toUpperCase()}
            </span>
          )}
          <span
            className={`font-display text-xs ${
              pathname === "/profile" ? "text-surface" : "text-on-surface-muted"
            }`}
          >
            {displayName.length > 12
              ? displayName.slice(0, 12) + "..."
              : displayName}
          </span>
        </Link>
        <button
          onClick={onSignOut}
          className="btn-ghost px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em]"
        >
          Sign Out
        </button>
      </>
    );
  }
  return (
    <Link
      href="/login"
      className="btn-ghost px-3.5 py-1.5 font-display text-[0.85rem]"
    >
      Sign In
    </Link>
  );
}
