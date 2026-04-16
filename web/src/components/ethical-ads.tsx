"use client";

import Script from "next/script";

/**
 * Renders an EthicalAds text placement.
 *
 * Visibility is governed by <AdSlot /> (pathname + supporter check);
 * this component just emits the DOM target and loads the EthicalAds script.
 * Returns null if NEXT_PUBLIC_ETHICAL_ADS_PUBLISHER_ID is unset, so it
 * ships as a no-op until the publisher application is approved.
 */
export function EthicalAds() {
  const publisher = process.env.NEXT_PUBLIC_ETHICAL_ADS_PUBLISHER_ID;
  if (!publisher) return null;

  return (
    <aside
      className="mx-auto my-6 w-full max-w-3xl px-6"
      aria-label="Sponsored content"
    >
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-lowest p-4">
        <p className="mb-2 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted/60">
          Sponsored -- supporters are ad-free
        </p>
        <div
          data-ea-publisher={publisher}
          data-ea-type="text"
          data-ea-style="stickybox"
        />
      </div>
      <Script
        src="https://media.ethicalads.io/media/client/ethicalads.min.js"
        strategy="afterInteractive"
      />
    </aside>
  );
}
