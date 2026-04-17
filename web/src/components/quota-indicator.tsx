import type { AiUsageMonth, AiUsageToday } from "@/lib/api";

interface QuotaIndicatorProps {
  today: AiUsageToday;
  month?: AiUsageMonth | null;
  supporter?: boolean;
  unlimited?: boolean;
  className?: string;
}

export function QuotaIndicator({
  today,
  month,
  supporter = false,
  unlimited = false,
  className = "",
}: QuotaIndicatorProps) {
  if (unlimited) {
    return (
      <div
        className={`flex flex-col gap-0.5 font-display text-xs ${className}`}
      >
        <span className="text-tertiary">Unlimited (admin)</span>
      </div>
    );
  }

  const dailyExhausted = today.remaining <= 0;
  const monthlyExhausted = month ? month.remaining <= 0 : false;

  return (
    <div className={`flex flex-col gap-0.5 font-display text-xs ${className}`}>
      <span className={dailyExhausted ? "text-tertiary" : "text-on-surface-muted"}>
        {dailyExhausted
          ? "Daily limit reached -- resets at midnight UTC"
          : `${today.used}/${today.limit} analyses used today`}
      </span>
      {supporter && month ? (
        <span
          className={monthlyExhausted ? "text-tertiary" : "text-on-surface-muted/70"}
        >
          {monthlyExhausted
            ? "Monthly soft cap reached -- contact support"
            : `${month.used}/${month.soft_cap} this month`}
        </span>
      ) : null}
    </div>
  );
}
