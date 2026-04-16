import Link from "next/link";

export function SponsorBanner() {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface-lowest px-5 py-3 text-center">
      <p className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
        Sponsor Spot
      </p>
      <p className="mt-1 font-body text-xs text-on-surface-muted">
        Want to reach competitive Pokemon players?{" "}
        <Link href="/support" className="text-primary hover:underline">
          Get in touch
        </Link>
      </p>
    </div>
  );
}
