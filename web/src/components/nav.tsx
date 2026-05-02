"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { resetOnboardingTour } from "@/components/onboarding-tour";
import { SupportPill } from "@/components/support-pill";
import { fetchProfile } from "@/lib/api";
import type { User } from "@supabase/supabase-js";

interface ProfileBrief {
  display_name: string | null;
  avatar_sprite_url: string | null;
  email: string | null;
}

const PRIMARY_LINKS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/pokemon", label: "Pokedex", match: (p: string) => p.startsWith("/pokemon") },
  { href: "/draft", label: "Draft", match: (p: string) => p.startsWith("/draft") },
  { href: "/calc", label: "Calc", match: (p: string) => p.startsWith("/calc") },
  { href: "/roster", label: "Roster", match: (p: string) => p === "/roster" },
  { href: "/teams", label: "Teams", match: (p: string) => p.startsWith("/teams") },
  { href: "/cheatsheet", label: "Cheatsheet", match: (p: string) => p.startsWith("/cheatsheet") },
  { href: "/meta", label: "Meta", match: (p: string) => p.startsWith("/meta") },
  { href: "/speed-tiers", label: "Speed", match: (p: string) => p.startsWith("/speed-tiers") },
  { href: "/matches", label: "Matches", match: (p: string) => p.startsWith("/matches") },
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
    <nav className="relative z-20 border-b border-outline-variant bg-surface/70 backdrop-blur-[2px]">
      <div className="flex items-center justify-between px-6 py-4 lg:px-9">
        {/* LEFT: logo + tour reset */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-[0.95rem] font-bold tracking-[-0.02em] text-on-surface">
                pokecomp
              </div>
              <div className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-on-surface-muted mt-0.5">
                S1 · WK 17
              </div>
            </div>
          </Link>
          <button
            onClick={resetOnboardingTour}
            className="ml-1 hidden sm:flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant text-[0.6rem] font-mono text-on-surface-dim hover:text-accent hover:border-accent/40 transition-colors"
            title="Show feature tour"
          >
            ?
          </button>
        </div>

        {/* CENTER: primary links (desktop) */}
        <div className="hidden lg:flex items-center gap-7 text-[0.85rem]">
          {PRIMARY_LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  active
                    ? "text-accent font-semibold"
                    : "text-on-surface-muted hover:text-on-surface"
                }`}
              >
                {link.label}
              </Link>
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
            className="lg:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-surface-mid transition-colors"
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

      {/* MOBILE menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-outline-variant bg-surface px-6 pb-5 pt-3">
          <div className="flex flex-col gap-1">
            {PRIMARY_LINKS.map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-surface-mid text-accent font-semibold"
                      : "text-on-surface-muted hover:text-on-surface hover:bg-surface-mid"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-outline-variant pt-4 sm:hidden">
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
    <div
      className="grid h-8 w-8 place-items-center rounded-lg shrink-0"
      style={{
        background:
          "conic-gradient(from 220deg, #FF2D7A, #7E22CE, #FFD23F, #FF2D7A)",
      }}
    >
      <div
        className="grid h-[22px] w-[22px] place-items-center rounded-[5px]"
        style={{ background: "var(--color-surface)" }}
      >
        <span className="font-mono text-[0.8rem] font-extrabold leading-none text-accent">
          P
        </span>
      </div>
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
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
            pathname === "/profile"
              ? "bg-surface-mid text-accent"
              : "hover:bg-surface-mid"
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
                  ? "border-accent/40 text-accent"
                  : "border-outline-variant text-on-surface-muted"
              }`}
            >
              {displayName[0]?.toUpperCase()}
            </span>
          )}
          <span
            className={`font-display text-xs ${
              pathname === "/profile" ? "text-accent" : "text-on-surface-muted"
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
