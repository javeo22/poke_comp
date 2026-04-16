interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: "block" | "inline";
  className?: string;
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  onRetry,
  variant = "block",
  className = "",
}: ErrorCardProps) {
  if (variant === "inline") {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-low px-4 py-3 ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-tertiary"
          />
          <p className="font-body text-sm text-on-surface">{message}</p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="btn-ghost px-3 py-1 text-xs"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`card p-6 text-center ${className}`}
      role="alert"
    >
      <p className="font-display text-[0.6rem] uppercase tracking-wider text-tertiary">
        Error
      </p>
      <h3 className="mt-2 font-display text-lg font-semibold text-on-surface">
        {title}
      </h3>
      <p className="mt-2 font-body text-sm text-on-surface-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary mt-4 px-4 py-2 text-sm"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
