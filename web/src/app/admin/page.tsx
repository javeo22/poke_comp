"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminStats,
  fetchAdminAiCosts,
  fetchAdminDataHealth,
  fetchAdminDataFreshness,
  fetchAdminPokemon,
  updateAdminPokemon,
  fetchAdminMoves,
  updateAdminMove,
  fetchAdminItems,
  updateAdminItem,
  fetchAdminMetaSnapshots,
  fetchStrategyNotes,
  createStrategyNote,
  updateStrategyNote,
  deleteStrategyNote,
  fetchPendingReviews,
  approveReview,
  rejectReview,
} from "@/lib/api";
import type { StrategyNote, ReviewQueueItem } from "@/lib/api";
import type {
  AdminStats,
  AdminAiCosts,
  DataHealthReport,
  DataFreshness,
} from "@/lib/api";
import { ChevronDown, ChevronUp, Check, X, Zap } from "lucide-react";

// ── Tabs ──

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "review", label: "Review" },
  { id: "pokemon", label: "Pokemon" },
  { id: "moves", label: "Moves" },
  { id: "items", label: "Items" },
  { id: "meta", label: "Meta" },
  { id: "strategy", label: "Strategy" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Main Page ──

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [error, setError] = useState<string | null>(null);

  // Catch 403 on first load to show access denied
  const [accessDenied, setAccessDenied] = useState(false);

  if (accessDenied) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="rounded-[1rem] bg-tertiary/10 p-12 text-center">
          <h1 className="font-display text-2xl font-bold text-tertiary">
            Access Denied
          </h1>
          <p className="mt-2 font-body text-sm text-on-surface-muted">
            Admin access is required to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
          Admin
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-muted">
          Data management &middot; Health monitoring &middot; Cost tracking
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-[1rem] bg-tertiary/10 p-4">
          <p className="font-body text-sm text-tertiary">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-[1rem] bg-surface-low p-1 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[100px] rounded-xl px-4 py-2.5 font-display text-xs uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-on-primary"
                : "text-on-surface-muted hover:bg-surface-mid"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <DashboardTab onAccessDenied={() => setAccessDenied(true)} onError={setError} />
      )}
      {activeTab === "review" && <ReviewTab onError={setError} />}
      {activeTab === "pokemon" && <PokemonTab onError={setError} />}
      {activeTab === "moves" && <MovesTab onError={setError} />}
      {activeTab === "items" && <ItemsTab onError={setError} />}
      {activeTab === "meta" && <MetaTab onError={setError} />}
      {activeTab === "strategy" && <StrategyTab onError={setError} />}
    </div>
  );
}

// ── Dashboard Tab ──

function DashboardTab({
  onAccessDenied,
  onError,
}: {
  onAccessDenied: () => void;
  onError: (msg: string | null) => void;
}) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [costs, setCosts] = useState<AdminAiCosts | null>(null);
  const [health, setHealth] = useState<DataHealthReport | null>(null);
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, c, h, f] = await Promise.all([
          fetchAdminStats(),
          fetchAdminAiCosts(30),
          fetchAdminDataHealth(),
          fetchAdminDataFreshness(),
        ]);
        setStats(s);
        setCosts(c);
        setHealth(h);
        setFreshness(f);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load";
        if (msg.includes("403") || msg.includes("Admin")) {
          onAccessDenied();
        } else {
          onError(msg);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [onAccessDenied, onError]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[1rem] bg-surface-low" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Champions Pokemon" value={stats.pokemon_champions} />
          <StatCard label="Champions Moves" value={stats.moves_champions} />
          <StatCard label="Champions Items" value={stats.items_champions} />
          <StatCard label="Total Abilities" value={stats.abilities_total} />
        </div>
      )}

      {/* AI Costs */}
      {costs && (
        <div className="rounded-[1rem] bg-surface-low p-6">
          <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            AI Costs (Last 30 Days)
          </h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
            <StatCard label="Total Spend" value={`$${costs.total_cost.toFixed(2)}`} />
            <StatCard label="Total Requests" value={costs.total_requests} />
            <StatCard label="Cached" value={costs.cached_requests} />
            <StatCard
              label="Cache Rate"
              value={
                costs.total_requests > 0
                  ? `${Math.round((costs.cached_requests / costs.total_requests) * 100)}%`
                  : "0%"
              }
            />
          </div>
          {costs.by_endpoint && Object.keys(costs.by_endpoint).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(costs.by_endpoint).map(([ep, cost]) => (
                <div key={ep} className="rounded-lg bg-surface-mid px-3 py-2">
                  <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                    {ep}
                  </span>
                  <p className="font-display text-sm font-bold text-on-surface">
                    ${cost.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data Health */}
      {health && (
        <div className="rounded-[1rem] bg-surface-low p-6">
          <div className="mb-4 flex items-center gap-3">
            <h3 className="font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Data Health
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${
                health.overall === "healthy"
                  ? "bg-secondary-container/40 text-secondary"
                  : "bg-tertiary-container/40 text-tertiary"
              }`}
            >
              {health.overall}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {health.checks.map((check, i) => (
              <div key={i} className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    check.status === "pass" ? "bg-secondary" : "bg-tertiary"
                  }`}
                />
                <span className="font-body text-xs text-on-surface">{check.name}</span>
                {check.details && check.details.length > 0 && (
                  <span className="font-body text-[0.6rem] text-tertiary">
                    {check.details.length} issue{check.details.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Freshness */}
      {freshness && (
        <div className="rounded-[1rem] bg-surface-low p-6">
          <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Data Freshness
          </h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Object.entries(freshness.usage_data).map(([src, dateStr]) => (
              <div key={src} className="rounded-lg bg-surface-mid px-3 py-2">
                <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                  {src}
                </span>
                <p className="font-body text-xs text-on-surface">{dateStr}</p>
              </div>
            ))}
            {Object.entries(freshness.meta_snapshots).map(([fmt, dateStr]) => (
              <div key={fmt} className="rounded-lg bg-surface-mid px-3 py-2">
                <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                  Meta: {fmt}
                </span>
                <p className="font-body text-xs text-on-surface">{dateStr}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1rem] bg-surface-low p-4">
      <p className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-on-surface">{value}</p>
    </div>
  );
}

// ── Data Table Tab (shared pattern for Pokemon, Moves, Items) ──

function DataTableTab<T extends Record<string, unknown>>({
  fetchFn,
  updateFn,
  columns,
  toggleField,
  idField = "id",
  onError,
}: {
  fetchFn: (params: Record<string, unknown>) => Promise<T[]>;
  updateFn: (id: number, updates: Record<string, unknown>) => Promise<unknown>;
  columns: { key: string; label: string; width?: string }[];
  toggleField?: string;
  idField?: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const [championsOnly, setChampionsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFn({
        search,
        champions_only: championsOnly,
        limit: LIMIT,
        offset,
      });
      setRows(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchFn, search, championsOnly, offset, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (row: T) => {
    if (!toggleField) return;
    const id = row[idField] as number;
    const current = row[toggleField] as boolean;
    try {
      await updateFn(id, { [toggleField]: !current });
      setRows((prev) =>
        prev.map((r) =>
          (r[idField] as number) === id
            ? { ...r, [toggleField]: !current }
            : r
        )
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search by name..."
          className="input-field h-10 w-64 rounded-xl px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
        />
        {toggleField && (
          <label className="flex items-center gap-2 font-display text-xs text-on-surface-muted">
            <input
              type="checkbox"
              checked={championsOnly}
              onChange={(e) => {
                setChampionsOnly(e.target.checked);
                setOffset(0);
              }}
              className="accent-primary"
            />
            Champions only
          </label>
        )}
        <span className="font-display text-[0.6rem] text-on-surface-muted/50">
          {rows.length} results
        </span>
      </div>

      {/* Table */}
      <div className="rounded-[1rem] bg-surface-low overflow-x-auto">
        {loading ? (
          <div className="p-8">
            <div className="h-48 animate-pulse rounded-xl bg-surface-mid" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-body text-sm text-on-surface-muted">No results found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
                {toggleField && (
                  <th className="px-4 py-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted w-24">
                    Champions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-outline-variant/30 transition-colors hover:bg-surface-mid/30"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5">
                      <CellRenderer value={row[col.key]} />
                    </td>
                  ))}
                  {toggleField && (
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleToggle(row)}
                        className={`rounded-full px-3 py-1 font-display text-[0.55rem] uppercase tracking-wider transition-colors ${
                          row[toggleField]
                            ? "bg-secondary-container/40 text-secondary"
                            : "bg-surface-mid text-on-surface-muted"
                        }`}
                      >
                        {row[toggleField] ? "Yes" : "No"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          disabled={offset === 0}
          className="btn-ghost h-8 px-4 font-display text-xs uppercase tracking-wider disabled:opacity-30"
        >
          Previous
        </button>
        <span className="font-display text-[0.6rem] text-on-surface-muted">
          {offset + 1}--{offset + rows.length}
        </span>
        <button
          onClick={() => setOffset(offset + LIMIT)}
          disabled={rows.length < LIMIT}
          className="btn-ghost h-8 px-4 font-display text-xs uppercase tracking-wider disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CellRenderer({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="font-body text-xs text-on-surface-muted/40">--</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`font-display text-xs ${value ? "text-secondary" : "text-on-surface-muted"}`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <span className="font-body text-xs text-on-surface-muted" title={value.join(", ")}>
        {value.length > 3 ? `${value.slice(0, 3).join(", ")}... (+${value.length - 3})` : value.join(", ")}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <span className="font-body text-xs text-on-surface-muted">
        {JSON.stringify(value).slice(0, 40)}...
      </span>
    );
  }
  return <span className="font-body text-xs text-on-surface">{String(value)}</span>;
}

// ── Review Tab ──

function ReviewTab({ onError }: { onError: (msg: string | null) => void }) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPendingReviews();
      setItems(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load pending reviews");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleApprove = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await approveReview(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to approve item");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await rejectReview(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to reject item");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const highConfidenceItems = items.filter(
      (item) => (item.metadata?.confidence ?? 0) > 0.9
    );
    if (highConfidenceItems.length === 0) return;

    if (!confirm(`Approve ${highConfidenceItems.length} items with >90% confidence?`)) return;

    setLoading(true);
    try {
      for (const item of highConfidenceItems) {
        await approveReview(item.id);
      }
      setItems((prev) =>
        prev.filter((item) => !highConfidenceItems.some((h) => h.id === item.id))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to bulk approve items");
      loadItems();
    } finally {
      setLoading(false);
    }
  };

  const highConfidenceCount = items.filter(
    (item) => (item.metadata?.confidence ?? 0) > 0.9
  ).length;

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[1rem] bg-surface-low" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Pending Reviews ({items.length})
        </h3>
        {highConfidenceCount > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-display text-[0.65rem] font-bold uppercase tracking-wider text-on-primary transition-all hover:brightness-110 disabled:opacity-50"
          >
            <Zap size={12} className="fill-current" />
            Bulk Approve ({highConfidenceCount})
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-[1rem] bg-surface-low p-12 text-center border border-outline-variant">
          <Check className="mx-auto h-12 w-12 text-secondary mb-4" />
          <h3 className="font-display text-lg font-bold text-on-surface">Queue Clear</h3>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            All data has been reviewed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-[1rem] border bg-surface-low transition-colors ${
                expandedId === item.id ? "border-primary/40" : "border-outline-variant"
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-1 items-center gap-6">
                  <div className="flex flex-col">
                    <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">Source</span>
                    <span className="font-display text-sm font-bold text-on-surface">
                      {item.source}
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">Category</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-primary">
                        {item.metadata?.category || "Unknown"}
                      </span>
                      {item.metadata?.confidence !== undefined && (
                        <span className={`font-display text-[0.65rem] font-bold ${
                          item.metadata.confidence > 0.9 ? "text-secondary" : "text-on-surface-muted"
                        }`}>
                          {Math.round(item.metadata.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-col flex-1">
                    <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">Reason</span>
                    <span className="font-body text-xs text-on-surface-muted truncate max-w-xs">
                      {item.metadata?.reason || "--"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={!!processingId}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-colors hover:bg-secondary hover:text-on-secondary disabled:opacity-30"
                    title="Approve"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={!!processingId}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary transition-colors hover:bg-tertiary hover:text-on-tertiary disabled:opacity-30"
                    title="Reject"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-mid text-on-surface-muted transition-colors hover:text-on-surface"
                  >
                    {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {expandedId === item.id && (
                <div className="border-t border-outline-variant p-4 bg-surface-mid/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-display text-[0.6rem] uppercase tracking-wider text-primary mb-2">Payload Data</h4>
                      <pre className="overflow-auto rounded-lg bg-surface-low p-4 font-mono text-[0.7rem] text-on-surface-muted max-h-96">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-display text-[0.6rem] uppercase tracking-wider text-secondary mb-2">Full Metadata</h4>
                      <pre className="overflow-auto rounded-lg bg-surface-low p-4 font-mono text-[0.7rem] text-on-surface-muted max-h-96">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pokemon Tab ──

function PokemonTab({ onError }: { onError: (msg: string | null) => void }) {
  return (
    <DataTableTab
      fetchFn={fetchAdminPokemon}
      updateFn={updateAdminPokemon}
      toggleField="champions_eligible"
      columns={[
        { key: "id", label: "ID", width: "60px" },
        { key: "name", label: "Name" },
        { key: "types", label: "Types" },
        { key: "abilities", label: "Abilities" },
        { key: "generation", label: "Gen", width: "50px" },
      ]}
      onError={onError}
    />
  );
}

// ── Moves Tab ──

function MovesTab({ onError }: { onError: (msg: string | null) => void }) {
  return (
    <DataTableTab
      fetchFn={fetchAdminMoves}
      updateFn={updateAdminMove}
      toggleField="champions_available"
      columns={[
        { key: "id", label: "ID", width: "60px" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "category", label: "Category" },
        { key: "power", label: "Power", width: "60px" },
        { key: "accuracy", label: "Acc", width: "60px" },
      ]}
      onError={onError}
    />
  );
}

// ── Items Tab ──

function ItemsTab({ onError }: { onError: (msg: string | null) => void }) {
  return (
    <DataTableTab
      fetchFn={fetchAdminItems}
      updateFn={updateAdminItem}
      toggleField="champions_shop_available"
      columns={[
        { key: "id", label: "ID", width: "60px" },
        { key: "name", label: "Name" },
        { key: "category", label: "Category" },
        { key: "vp_cost", label: "VP Cost", width: "70px" },
        { key: "effect_text", label: "Effect" },
      ]}
      onError={onError}
    />
  );
}

// ── Meta Tab ──

function MetaTab({ onError }: { onError: (msg: string | null) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminMetaSnapshots({ limit: 20 })
      .then(setSnapshots)
      .catch((err) => onError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [onError]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-[1rem] bg-surface-low" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {snapshots.map((snap) => (
        <div key={snap.id} className="rounded-[1rem] bg-surface-low overflow-hidden border border-outline-variant">
          <button
            onClick={() => setExpanded(expanded === snap.id ? null : snap.id)}
            className="flex w-full items-center gap-4 p-4 text-left hover:bg-surface-mid/30"
          >
            <span className="font-display text-sm font-bold text-on-surface">
              {snap.format}
            </span>
            <span className="font-body text-xs text-on-surface-muted">
              {snap.snapshot_date}
            </span>
            <span className="font-body text-xs text-on-surface-muted/50">
              {snap.source ?? "ai"}
            </span>
          </button>
          {expanded === snap.id && snap.tier_data && (
            <div className="border-t border-outline-variant p-4">
              {Object.entries(snap.tier_data as Record<string, string[]>).map(
                ([tier, pokemon]) => (
                  <div key={tier} className="mb-2">
                    <span className="font-display text-xs font-bold text-primary">
                      {tier}:
                    </span>{" "}
                    <span className="font-body text-xs text-on-surface-muted">
                      {(pokemon as string[]).join(", ")}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const CATEGORIES = ["archetype", "matchup", "general", "tip"] as const;

function StrategyTab({ onError }: { onError: (msg: string | null) => void }) {
  const [notes, setNotes] = useState<StrategyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchStrategyNotes(true)
      .then(setNotes)
      .catch((err) => onError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setTitle(""); setCategory("general"); setContent(""); setTags(""); setEditing(null);
  };

  const startEdit = (note: StrategyNote) => {
    setTitle(note.title); setCategory(note.category);
    setContent(note.content); setTags(note.tags.join(", ")); setEditing(note.id);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (editing) {
        await updateStrategyNote(editing, { title: title.trim(), category, content: content.trim(), tags: tagList });
      } else {
        await createStrategyNote({ title: title.trim(), category, content: content.trim(), tags: tagList, format: "vgc2026" });
      }
      resetForm(); load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-48 animate-pulse rounded-[1rem] bg-surface-low" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Form */}
      <div className="rounded-[1rem] border border-outline-variant bg-surface-low p-5">
        <h3 className="mb-4 font-display text-xs uppercase tracking-wider text-on-surface-muted">
          {editing ? "Edit Note" : "New Strategy Note"}
        </h3>
        <div className="flex flex-col gap-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title" className="input-field" />
          <div className="flex gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-40">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)" className="input-field flex-1" />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Strategy content..." rows={4} className="input-field resize-y" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}
              className="btn-primary px-6 py-2 font-display text-xs uppercase tracking-wider disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
            {editing && (
              <button onClick={resetForm} className="btn-ghost px-4 py-2 font-display text-xs uppercase tracking-wider">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <div key={note.id} className={`rounded-[1rem] border bg-surface-low p-4 ${
            note.is_active ? "border-outline-variant" : "border-outline-variant/30 opacity-50"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-bold text-on-surface truncate">{note.title}</h4>
                  <span className="rounded-full bg-primary-container/30 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-primary shrink-0">
                    {note.category}
                  </span>
                  {!note.is_active && (
                    <span className="rounded-full bg-tertiary-container/30 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-tertiary shrink-0">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 font-body text-xs text-on-surface-muted line-clamp-2">{note.content}</p>
                {note.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.5rem] text-on-surface-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(note)} className="btn-ghost px-3 py-1 font-display text-[0.6rem] uppercase tracking-wider">Edit</button>
                <button onClick={async () => {
                  if (note.is_active) { await deleteStrategyNote(note.id); } else { await updateStrategyNote(note.id, { is_active: true }); }
                  load();
                }} className="btn-ghost px-3 py-1 font-display text-[0.6rem] uppercase tracking-wider">
                  {note.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="py-8 text-center text-sm text-on-surface-muted">No strategy notes yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
