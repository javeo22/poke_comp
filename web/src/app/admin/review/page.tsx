"use client";

import { useEffect, useState } from "react";
import { fetchPendingReviews, approveReview, rejectReview } from "@/lib/api";
import type { ReviewQueueItem } from "@/lib/api";
import { ChevronDown, ChevronUp, Check, X, Zap } from "lucide-react";

export default function AdminReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchPendingReviews();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleApprove = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await approveReview(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve item");
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject item");
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
    setError(null);
    try {
      // Sequential to avoid slamming the DB too hard, or parallel if small enough
      for (const item of highConfidenceItems) {
        await approveReview(item.id);
      }
      setItems((prev) =>
        prev.filter((item) => !highConfidenceItems.some((h) => h.id === item.id))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk approve items");
      loadItems(); // Refresh state on partial failure
    } finally {
      setLoading(false);
    }
  };

  const highConfidenceCount = items.filter(
    (item) => (item.metadata?.confidence ?? 0) > 0.9
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
            HITL Review Queue
          </h1>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            Verify and approve data before it goes to production.
          </p>
        </div>
        
        {highConfidenceCount > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-surface transition-all hover:brightness-110 disabled:opacity-50"
          >
            <Zap size={14} className="fill-current" />
            Bulk Approve ({highConfidenceCount})
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-[1rem] bg-danger/10 p-4 border border-danger/20">
          <p className="font-body text-sm text-danger">{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[1rem] bg-surface-low" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1rem] bg-surface-low p-12 text-center border border-outline-variant">
          <Check className="mx-auto h-12 w-12 text-success mb-4" />
          <h3 className="font-display text-lg font-bold text-on-surface">Queue Clear</h3>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            All scraped data has been processed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-[1rem] border bg-surface-low transition-colors ${
                expandedId === item.id ? "border-accent/40" : "border-outline-variant"
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-1 items-center gap-6">
                  <div className="flex flex-col">
                    <span className="mono-label text-on-surface-dim">Source</span>
                    <span className="font-display text-sm font-bold text-on-surface">
                      {item.source}
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="mono-label text-on-surface-dim">Ext ID</span>
                    <span className="font-body text-xs text-on-surface-muted">
                      {item.external_id || "N/A"}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="mono-label text-on-surface-dim">AI Classification</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-purple-container/40 px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-purple-soft">
                        {item.metadata?.category || "Unknown"}
                      </span>
                      {item.metadata?.confidence !== undefined && (
                        <span className={`font-mono text-[0.65rem] font-bold ${
                          item.metadata.confidence > 0.9 ? "text-accent" : "text-on-surface-muted"
                        }`}>
                          {Math.round(item.metadata.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-col flex-1">
                    <span className="mono-label text-on-surface-dim">Reason</span>
                    <span className="font-body text-xs text-on-surface-muted truncate max-w-xs">
                      {item.metadata?.reason || "--"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={!!processingId}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success transition-colors hover:bg-success hover:text-surface disabled:opacity-30"
                    title="Approve"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={!!processingId}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger transition-colors hover:bg-danger hover:text-surface disabled:opacity-30"
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
                <div className="border-t border-outline-variant p-4 bg-surface-lowest/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="mono-label text-accent mb-2">Payload Data</h4>
                      <pre className="overflow-auto rounded-lg bg-surface p-4 font-mono text-[0.7rem] text-on-surface-muted max-h-96">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="mono-label text-purple-soft mb-2">Full Metadata</h4>
                      <pre className="overflow-auto rounded-lg bg-surface p-4 font-mono text-[0.7rem] text-on-surface-muted max-h-96">
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
