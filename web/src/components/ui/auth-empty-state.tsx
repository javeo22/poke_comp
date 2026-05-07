"use client";

import Link from "next/link";
import { enableDemoMode } from "@/lib/demo-data";
import { EmptyState } from "@/components/ui/empty-state";

interface AuthEmptyStateProps {
  title: string;
  description: string;
  demoLabel?: string;
}

export function AuthEmptyState({
  title,
  description,
  demoLabel = "Try demo",
}: AuthEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={enableDemoMode}
            className="btn-ghost h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
          >
            {demoLabel}
          </button>
        </div>
      }
    />
  );
}
