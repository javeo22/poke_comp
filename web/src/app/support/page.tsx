import Image from "next/image";

const KOFI_URL = "https://ko-fi.com/pokecompapp";

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface mb-2">
        Support PokeComp
      </h1>
      <p className="font-body text-sm text-on-surface-muted mb-10">
        Help keep PokeComp free for everyone
      </p>

      {/* Main card */}
      <div className="rounded-xl border border-outline-variant bg-surface-low p-8">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">
          Why Support?
        </h2>
        <p className="font-body text-sm leading-relaxed text-on-surface mb-6">
          PokeComp is a free, open-source fan project built by one developer. Every
          feature -- including AI-powered draft analysis and cheatsheets -- is
          available to all users. Free accounts get a modest AI quota to try
          everything out, while Ko-fi supporters help cover the running costs
          and get extra perks as thanks:
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-8">
          <div className="rounded-lg bg-surface-mid p-4 text-center">
            <p className="font-display text-xs uppercase tracking-wider text-on-surface-muted mb-1">
              AI Analysis
            </p>
            <p className="font-body text-sm text-on-surface">
              Claude API calls for draft analysis and cheatsheets
            </p>
          </div>
          <div className="rounded-lg bg-surface-mid p-4 text-center">
            <p className="font-display text-xs uppercase tracking-wider text-on-surface-muted mb-1">
              Hosting
            </p>
            <p className="font-body text-sm text-on-surface">
              Vercel compute and Supabase database
            </p>
          </div>
          <div className="rounded-lg bg-surface-mid p-4 text-center">
            <p className="font-display text-xs uppercase tracking-wider text-on-surface-muted mb-1">
              Development
            </p>
            <p className="font-body text-sm text-on-surface">
              New features, data updates, and bug fixes
            </p>
          </div>
        </div>

        {/* Ko-fi button */}
        <div className="flex flex-col items-center gap-4">
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary h-14 px-10 font-display text-sm font-medium uppercase tracking-wider inline-flex items-center gap-3"
          >
            <Image
              src="/sprites/items/potion.png"
              alt=""
              width={22}
              height={22}
              className="image-rendering-pixelated"
              unoptimized
            />
            Buy me a Potion on Ko-fi
          </a>
          <p className="font-body text-xs text-on-surface-muted">
            One-time tips help; monthly supporters get the perks below
          </p>
        </div>
      </div>

      {/* Supporter perks */}
      <div className="mt-8 rounded-xl border border-outline-variant bg-surface-low p-6">
        <h3 className="font-display text-sm font-semibold text-on-surface mb-3">
          Supporter Perks (Ko-fi Monthly)
        </h3>
        <p className="font-body text-xs text-on-surface-muted mb-4">
          Monthly supporters are recognized on the site and get room to use the
          AI tools more heavily.
        </p>
        <ul className="font-body text-sm text-on-surface leading-relaxed flex flex-col gap-2">
          <li>
            <span className="text-tertiary">&bull;</span>{" "}Ad-free experience
            across the whole site
          </li>
          <li>
            <span className="text-tertiary">&bull;</span>{" "}30 AI analyses per
            day (vs 3 for free accounts)
          </li>
          <li>
            <span className="text-tertiary">&bull;</span>{" "}600-per-month
            fair-use soft cap; email if you hit it through legitimate use and
            we&apos;ll discuss a reset
          </li>
          <li>
            <span className="text-tertiary">&bull;</span>{" "}Supporter badge on
            your trainer card and public profile
          </li>
        </ul>
      </div>

      {/* Promise */}
      <div className="mt-6 rounded-xl border border-outline-variant bg-surface-lowest p-6">
        <h3 className="font-display text-sm font-semibold text-on-surface mb-3">
          The PokeComp Promise
        </h3>
        <ul className="font-body text-sm text-on-surface leading-relaxed flex flex-col gap-2">
          <li>
            Every feature stays free for every user -- no paywalled tools, no
            premium-only content
          </li>
          <li>
            Ads are privacy-first and contextual (via EthicalAds): no cookies,
            no tracking, no profiling
          </li>
          <li>
            Free accounts get enough AI quota to genuinely try every tool;
            supporters get more headroom as thanks, not exclusive features
          </li>
          <li>100% of donations go toward hosting, AI costs, and development</li>
        </ul>
      </div>
    </div>
  );
}
