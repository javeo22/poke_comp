"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Team } from "@/types/team";
import {
  fetchTeams,
  generateCheatsheet,
  fetchAllCheatsheets,
  fetchAiUsage,
  toggleCheatsheetVisibility,
} from "@/lib/api";
import type { AiUsageMonth, AiUsageToday, SavedCheatsheet } from "@/lib/api";
import { QuotaIndicator } from "@/components/quota-indicator";
import { exportCheatsheetPDF } from "@/lib/pdf-export";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";
import { CheatsheetContent } from "@/components/cheatsheet/cheatsheet-content";

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CheatsheetPage() {
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [savedCheatsheets, setSavedCheatsheets] = useState<SavedCheatsheet[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(preselectedTeamId || null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quota, setQuota] = useState<AiUsageToday | null>(null);
  const [quotaMonth, setQuotaMonth] = useState<AiUsageMonth | null>(null);
  const [isSupporter, setIsSupporter] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsResult, cheatsheetsResult] = await Promise.allSettled([
        fetchTeams({ limit: 200 }),
        fetchAllCheatsheets(),
      ]);
      if (teamsResult.status === "fulfilled") setTeams(teamsResult.value.data);
      if (cheatsheetsResult.status === "fulfilled") setSavedCheatsheets(cheatsheetsResult.value);
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
        })
        .catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Teams that don't have a cheatsheet yet
  const teamsWithoutCheatsheet = useMemo(() => {
    const hasSheet = new Set(savedCheatsheets.map((s) => s.team_id));
    return teams.filter((t) => !hasSheet.has(t.id));
  }, [teams, savedCheatsheets]);

  const teamOptions: DropdownOption[] = useMemo(
    () =>
      teamsWithoutCheatsheet.map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: `${t.format}${t.archetype_tag ? ` / ${t.archetype_tag}` : ""}`,
      })),
    [teamsWithoutCheatsheet]
  );

  // Also allow regenerating for teams that already have one
  const allTeamOptions: DropdownOption[] = useMemo(
    () =>
      teams.map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: `${t.format}${t.archetype_tag ? ` / ${t.archetype_tag}` : ""}`,
      })),
    [teams]
  );

  const handleGenerate = async () => {
    if (!selectedTeamId || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      await generateCheatsheet(selectedTeamId);
      // Reload all cheatsheets to get the new one
      const updated = await fetchAllCheatsheets();
      setSavedCheatsheets(updated);
      setExpandedId(selectedTeamId);
      setSelectedTeamId("");
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cheatsheet");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpand = (teamId: string) => {
    setExpandedId((prev) => (prev === teamId ? null : teamId));
  };

  // Find team name for a saved cheatsheet
  const teamNameMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="h-10 w-48 animate-pulse rounded-[1rem] bg-surface-low mb-8" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[1rem] bg-surface-low" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
          Cheatsheets
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-muted">
          AI-generated game plans &middot; One page per team
        </p>
      </div>

      {/* Generate new */}
      <div className="rounded-[1rem] bg-surface-low p-6 mb-8">
        <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Generate Cheatsheet
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-sm">
            <SearchableDropdown
              placeholder={
                allTeamOptions.length === 0 ? "No teams yet" : "Select a team..."
              }
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              options={allTeamOptions}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedTeamId || isGenerating || (quota !== null && quota.remaining <= 0)}
            className="btn-primary h-12 px-8 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          {quota !== null && (
            <QuotaIndicator today={quota} month={quotaMonth} supporter={isSupporter} />
          )}
        </div>
        {error && (
          <p className="mt-3 font-body text-sm text-tertiary">{error}</p>
        )}
      </div>

      {/* Saved cheatsheets */}
      {savedCheatsheets.length === 0 && !isGenerating ? (
        <div className="rounded-[1rem] bg-surface-low p-12 text-center">
          <p className="font-display text-sm text-on-surface-muted">
            No cheatsheets yet. Select a team above to generate one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isGenerating && (
            <div className="h-20 animate-pulse rounded-[1rem] bg-surface-low" />
          )}
          {savedCheatsheets.map((saved) => {
            const data = saved.cheatsheet_json;
            const team = teamNameMap.get(saved.team_id);
            const isExpanded = expandedId === saved.team_id;

            return (
              <div
                key={saved.team_id}
                className="rounded-[1rem] bg-surface-low overflow-hidden border border-outline-variant"
              >
                {/* Collapsed header -- always visible */}
                <button
                  onClick={() => toggleExpand(saved.team_id)}
                  className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-surface-mid/30"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 text-on-surface-muted transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg font-bold uppercase tracking-tight text-on-surface truncate">
                        {data.team_title}
                      </h3>
                      <span className="rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted shrink-0">
                        {data.format}
                      </span>
                    </div>
                    <p className="mt-0.5 font-display text-xs text-on-surface-muted truncate">
                      {team?.name ?? data.team_name} &middot; {data.archetype}
                    </p>
                  </div>
                  <span className="font-display text-[0.6rem] text-on-surface-muted/50 shrink-0">
                    {timeAgo(saved.updated_at)}
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-outline-variant px-5 pb-6 pt-4">
                    {/* Action bar */}
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCheatsheetPDF(data.team_title);
                        }}
                        className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const result = await toggleCheatsheetVisibility(saved.team_id);
                            setSavedCheatsheets((prev) =>
                              prev.map((s) =>
                                s.team_id === saved.team_id
                                  ? { ...s, is_public: result.is_public }
                                  : s
                              )
                            );
                          } catch (err) {
                            console.error("Toggle visibility failed:", err);
                          }
                        }}
                        className={`btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider ${
                          saved.is_public ? "text-green-400 border-green-400/30" : ""
                        }`}
                        title={saved.is_public ? "Make private" : "Make public"}
                      >
                        {saved.is_public ? "Public" : "Share"}
                      </button>
                      {saved.is_public && saved.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/share/${saved.id}`;
                            navigator.clipboard.writeText(url);
                          }}
                          className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider"
                          title="Copy share link"
                        >
                          Copy Link
                        </button>
                      )}
                      <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted/50">
                        {data.roster.length} Pokemon
                      </span>
                    </div>
                    <div id="cheatsheet-content">
                      <CheatsheetContent data={data} />
                    </div>
                    {/* Contextual support prompt */}
                    <div className="mt-4 rounded-xl bg-surface-mid/30 px-5 py-3 flex items-center justify-between gap-4">
                      <p className="font-body text-xs text-on-surface-muted">
                        Cheatsheets are powered by AI and cost real money to generate.
                        Help keep PokeComp free for everyone.
                      </p>
                      <a
                        href="https://ko-fi.com/pokecompapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost h-8 px-4 font-display text-[0.6rem] uppercase tracking-wider shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Support
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
