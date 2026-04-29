"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { fetchProfile, updateProfile } from "@/lib/api";
import { AvatarPickerModal } from "@/components/profile/avatar-picker-modal";
import { TrainerCard } from "@/components/profile/trainer-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { friendlyError } from "@/lib/errors";
import type { FullProfile } from "@/types/profile";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProfile()
      .then(setProfile)
      .catch((err) => setError(friendlyError(err).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      loadProfile();
    });
  }, [supabase, router, loadProfile]);

  const handleUpdateDisplayName = async (name: string) => {
    const updated = await updateProfile({
      display_name: name || null,
    });
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              display_name: updated.display_name,
            },
          }
        : prev
    );
  };

  const handleUpdateUsername = async (username: string) => {
    const updated = await updateProfile({ username: username || null });
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              username: updated.username,
            },
          }
        : prev
    );
  };

  const handleAvatarSelect = async (
    pokemonId: number,
    spriteUrl: string
  ) => {
    setAvatarPickerOpen(false);
    const updated = await updateProfile({ avatar_pokemon_id: pokemonId });
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              avatar_pokemon_id: updated.avatar_pokemon_id,
              avatar_sprite_url: updated.avatar_sprite_url ?? spriteUrl,
            },
          }
        : prev
    );
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ErrorCard
          title="Couldn't load your profile"
          message={error}
          onRetry={loadProfile}
        />
      </div>
    );
  }

  if (!profile) return null;

  const { stats } = profile;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-on-surface">
        Profile
      </h1>
      <p className="mb-8 font-body text-sm text-on-surface-muted">
        Your trainer card and battle stats
      </p>

      {/* Trainer Card */}
      <TrainerCard
        profile={profile.profile}
        email={profile.email}
        memberSince={profile.member_since}
        matchesPlayed={stats.matches_played}
        onUpdateDisplayName={handleUpdateDisplayName}
        onUpdateUsername={handleUpdateUsername}
        onOpenAvatarPicker={() => setAvatarPickerOpen(true)}
      />

      {/* Avatar Picker -- conditionally mounted so it remounts fresh each open */}
      {avatarPickerOpen && (
        <AvatarPickerModal
          onClose={() => setAvatarPickerOpen(false)}
          onSelect={handleAvatarSelect}
          currentAvatarId={profile.profile.avatar_pokemon_id}
        />
      )}

      {/* Core Stats */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Activity
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Teams" value={stats.team_count} />
          <StatCard label="Roster" value={stats.roster_count} />
          <StatCard label="Matches" value={stats.matches_played} />
          <StatCard
            label="Win Rate"
            value={stats.matches_played > 0 ? `${stats.win_rate}%` : "--"}
          />
        </div>
      </div>

      {/* Battle Stats */}
      {stats.matches_played > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Battle Stats
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Current Streak"
              value={
                stats.current_streak > 0
                  ? `${stats.current_streak}${stats.streak_type === "win" ? "W" : "L"}`
                  : "--"
              }
              accent={
                stats.streak_type === "win"
                  ? "text-green-500"
                  : stats.streak_type === "loss"
                    ? "text-primary"
                    : undefined
              }
            />
            <StatCard
              label="Best Win Streak"
              value={stats.best_streak > 0 ? `${stats.best_streak}W` : "--"}
            />
            <StatCard label="This Week" value={stats.matches_this_week} />
          </div>
        </div>
      )}

      {/* Insights */}
      {(stats.most_used_team || stats.most_faced_opponent) && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Insights
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.most_used_team && (
              <InsightCard label="Most Used Team" value={stats.most_used_team} />
            )}
            {stats.most_faced_opponent && (
              <InsightCard
                label="Most Faced Opponent"
                value={stats.most_faced_opponent}
              />
            )}
          </div>
        </div>
      )}

      {/* Recent Form */}
      {stats.recent_form.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Recent Form
          </h2>
          <div className="card flex items-center gap-2 p-4">
            {stats.recent_form.map((entry, i) => (
              <div
                key={i}
                title={`${entry.outcome === "win" ? "Win" : "Loss"} -- ${new Date(entry.played_at).toLocaleDateString()}`}
                className={`h-6 w-6 rounded-full ${
                  entry.outcome === "win"
                    ? "bg-green-600"
                    : "bg-primary"
                }`}
              />
            ))}
            {stats.recent_form.length < 10 && (
              <span className="ml-2 font-body text-xs text-on-surface-muted">
                {stats.recent_form.length}/10 recent
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSignOut}
          className="btn-ghost px-6 py-2 font-display text-xs uppercase tracking-wider hover:text-tertiary hover:border-tertiary/30"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-lowest p-4 text-center border border-outline-variant">
      <div
        className={`font-display text-2xl font-bold ${accent || "text-on-surface"}`}
      >
        {value}
      </div>
      <div className="mt-1 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
        {label}
      </div>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-lowest p-4 border border-outline-variant">
      <div className="font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
        {label}
      </div>
      <div className="mt-1 truncate font-display text-sm font-semibold text-on-surface">
        {value}
      </div>
    </div>
  );
}
