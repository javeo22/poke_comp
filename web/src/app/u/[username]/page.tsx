"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  fetchPublicProfile,
  fetchPublicCheatsheets,
} from "@/lib/api";
import type { PublicProfile, PublicCheatsheetSummary } from "@/lib/api";
import { SupporterBadge } from "@/components/profile/supporter-badge";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [cheatsheets, setCheatsheets] = useState<PublicCheatsheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    Promise.all([
      fetchPublicProfile(username),
      fetchPublicCheatsheets(username),
    ])
      .then(([p, cs]) => {
        if (cancelled) return;
        setProfile(p);
        setCheatsheets(cs);
      })
      .catch(() => {
        if (!cancelled) setError("Trainer not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-surface-high" />
          <div className="h-24 rounded-lg bg-surface-high" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-on-surface">
          Trainer Not Found
        </h1>
        <p className="mt-2 text-sm text-on-surface-muted">
          No trainer with username &quot;{username}&quot; exists.
        </p>
        <Link
          href="/pokemon"
          className="mt-6 inline-block btn-primary px-6 py-2 font-display text-xs uppercase tracking-wider"
        >
          Browse Pokedex
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Trainer card */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-lowest">
            {profile.avatar_sprite_url ? (
              <Image
                src={profile.avatar_sprite_url}
                alt={displayName}
                width={56}
                height={56}
                className="image-rendering-pixelated"
                unoptimized
              />
            ) : (
              <span className="font-display text-2xl text-on-surface-muted">
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">
                {displayName}
              </h1>
              {profile.supporter ? <SupporterBadge size="sm" /> : null}
            </div>
            <p className="mt-0.5 text-sm text-on-surface-muted">
              @{profile.username}
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs text-on-surface-muted">
              <span>{profile.team_count} teams</span>
              <span>{profile.cheatsheet_count} shared cheatsheets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Public cheatsheets */}
      <div className="mt-8">
        <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Shared Cheatsheets
        </h2>
        {cheatsheets.length === 0 ? (
          <div className="card py-12 text-center">
            <p className="text-sm text-on-surface-muted">
              No shared cheatsheets yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cheatsheets.map((cs) => (
              <Link
                key={cs.id}
                href={`/share/${cs.id}`}
                className="card-interactive flex items-center justify-between p-4"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold tracking-tight text-on-surface truncate">
                    {cs.team_name || "Untitled Team"}
                  </h3>
                  {cs.team_format && (
                    <span className="mt-0.5 inline-block rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
                      {cs.team_format}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-display text-[0.6rem] text-on-surface-muted/50">
                  {new Date(cs.updated_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
