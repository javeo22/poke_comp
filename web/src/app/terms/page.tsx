export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface mb-8">
        Terms of Service
      </h1>
      <p className="font-body text-xs text-on-surface-muted mb-8">
        Last updated: April 16, 2026
      </p>

      <div className="flex flex-col gap-8 font-body text-sm leading-relaxed text-on-surface">
        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            1. About PokeComp
          </h2>
          <p>
            PokeComp is a free, non-commercial fan project that provides competitive
            battling tools for Pokemon Champions. It is not affiliated with, endorsed
            by, or connected to The Pokemon Company, Nintendo, Game Freak, or any
            official Pokemon entity.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            2. Acceptance of Terms
          </h2>
          <p>
            By using PokeComp, you agree to these Terms of Service. If you do not
            agree, please do not use the service. We may update these terms at any
            time; continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            3. User Accounts
          </h2>
          <p>
            Account creation requires a valid email address. You are responsible for
            maintaining the security of your account credentials. PokeComp uses
            Supabase for authentication and does not store passwords directly.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            4. AI-Generated Content
          </h2>
          <p>
            PokeComp uses AI (powered by Anthropic Claude) to generate draft analysis,
            team cheatsheets, and tier list parsing. AI-generated content is provided
            for informational and entertainment purposes only. It should not be treated
            as authoritative game advice. Accuracy is not guaranteed, and AI outputs
            may contain errors or outdated information.
          </p>
          <p className="mt-2">
            AI analysis is rate-limited on a per-user daily basis to manage
            costs. Free accounts receive 3 non-cached requests per day;
            supporters receive 30 per day with a fair-use monthly soft cap (see
            Section 5). Cached results do not count against any limit.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            5. Supporter Benefits
          </h2>
          <p>
            PokeComp is free to use. Ko-fi supporters receive:
          </p>
          <ul className="list-disc pl-6 mt-2 flex flex-col gap-1">
            <li>Ad-free experience across all pages</li>
            <li>30 AI analyses per day (vs 3 for free accounts)</li>
            <li>
              600 AI analyses per month fair-use soft cap; contact support to
              discuss a reset if you hit it through legitimate use
            </li>
            <li>A Supporter badge on your trainer card and public profile</li>
          </ul>
          <p className="mt-2">
            Supporter status is tied to an active Ko-fi membership. Donations
            are voluntary; all core features remain free.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            6. Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 flex flex-col gap-1">
            <li>Attempt to bypass rate limits or abuse AI features</li>
            <li>Use automated tools to scrape or bulk-access the service</li>
            <li>Interfere with the operation of the service</li>
            <li>Use the service for any illegal purpose</li>
            <li>Attempt to access other users&apos; data</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            7. Data Sources and Attribution
          </h2>
          <p>
            PokeComp aggregates publicly available competitive Pokemon data from
            community sources including PokeAPI, Smogon (pkmn project), Pikalytics,
            and Limitless VGC. All data remains the property of its respective owners.
            PokeComp does not claim ownership of any Pokemon-related data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            8. Intellectual Property
          </h2>
          <p>
            Pokemon, Pokemon Champions, and all related trademarks, characters, and
            imagery are the property of The Pokemon Company, Nintendo, and Game Freak.
            PokeComp is a transformative fan tool providing strategic analysis not
            available in the original games.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            9. Service Availability
          </h2>
          <p>
            PokeComp is provided &ldquo;as is&rdquo; without warranties of any kind.
            The service may be unavailable, modified, or discontinued at any time
            without notice. We are not liable for any loss of data or service
            interruptions.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            10. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, PokeComp and its developer shall
            not be liable for any indirect, incidental, or consequential damages
            arising from the use of this service. Total liability is limited to the
            amount paid for the service (currently $0, as PokeComp is free).
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            11. Contact
          </h2>
          <p>
            For questions about these terms, contact the developer via the project&apos;s
            GitHub repository.
          </p>
        </section>
      </div>
    </div>
  );
}
