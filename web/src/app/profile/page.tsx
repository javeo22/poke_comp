"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

interface ProfileStats {
  teamCount: number;
  rosterCount: number;
  matchesPlayed: number;
  winRate: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) {
        router.push("/login");
        return;
      }
      setUser(authUser);

      // Load stats inline to satisfy exhaustive-deps
      (async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const headers: HeadersInit = {};

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          const [teamsRes, rosterRes, statsRes] = await Promise.all([
            fetch(`${apiUrl}/teams?limit=1`, { headers }),
            fetch(`${apiUrl}/user-pokemon?limit=1`, { headers }),
            fetch(`${apiUrl}/matchups/stats`, { headers }),
          ]);

          const teams = teamsRes.ok ? await teamsRes.json() : { count: 0 };
          const roster = rosterRes.ok ? await rosterRes.json() : { count: 0 };
          const matchStats = statsRes.ok
            ? await statsRes.json()
            : { overall: { total: 0, win_rate: 0 } };

          setStats({
            teamCount: teams.count || 0,
            rosterCount: roster.count || 0,
            matchesPlayed: matchStats.overall?.total || 0,
            winRate: matchStats.overall?.win_rate || 0,
          });
        } catch {
          // Stats are non-critical -- silently fail
        } finally {
          setLoading(false);
        }
      })();
    });
  }, [supabase, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-surface-high" />
          <div className="card p-8">
            <div className="space-y-4">
              <div className="h-5 w-64 rounded bg-surface-high" />
              <div className="h-5 w-48 rounded bg-surface-high" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-on-surface">
        Profile
      </h1>
      <p className="mb-8 font-body text-sm text-on-surface-muted">
        Your account and activity overview
      </p>

      {/* Account info */}
      <div className="card p-6 mb-6">
        <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-muted">Email</span>
            <span className="text-sm text-on-surface">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-muted">Member since</span>
            <span className="text-sm text-on-surface">{memberSince}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-muted">Email confirmed</span>
            <span className="text-sm text-on-surface">
              {user.email_confirmed_at ? "Yes" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="card p-6 mb-6">
          <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Activity
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Teams" value={stats.teamCount} />
            <StatCard label="Roster" value={stats.rosterCount} />
            <StatCard label="Matches" value={stats.matchesPlayed} />
            <StatCard
              label="Win Rate"
              value={stats.matchesPlayed > 0 ? `${stats.winRate}%` : "--"}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-surface-lowest p-4 text-center border border-outline-variant">
      <div className="font-display text-2xl font-bold text-on-surface">{value}</div>
      <div className="mt-1 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
        {label}
      </div>
    </div>
  );
}
