import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`card flex flex-col items-center p-10 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 text-on-surface-muted" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-lg font-semibold text-on-surface">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md font-body text-sm text-on-surface-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
