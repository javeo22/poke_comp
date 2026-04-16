"use client";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface mb-8">
        Privacy Policy
      </h1>
      <p className="font-body text-xs text-on-surface-muted mb-8">
        Last updated: April 15, 2026
      </p>

      <div className="flex flex-col gap-8 font-body text-sm leading-relaxed text-on-surface">
        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            1. Overview
          </h2>
          <p>
            PokeComp is a free fan project for competitive Pokemon Champions players.
            We take your privacy seriously and collect only the minimum data necessary
            to provide the service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            2. Data We Collect
          </h2>

          <h3 className="font-display text-sm font-semibold text-on-surface mt-4 mb-2">
            Account Data
          </h3>
          <p>
            When you create an account, we store your email address through Supabase
            Auth. This is used solely for authentication. We do not share your email
            with third parties.
          </p>

          <h3 className="font-display text-sm font-semibold text-on-surface mt-4 mb-2">
            User-Created Data
          </h3>
          <p>
            Your roster, teams, matchup logs, and any notes you enter are stored in
            our database, linked to your account. This data is only accessible to you
            through Row Level Security (RLS) policies.
          </p>

          <h3 className="font-display text-sm font-semibold text-on-surface mt-4 mb-2">
            AI Usage Data
          </h3>
          <p>
            When you use AI features (draft analysis, cheatsheets), we log the request
            type, token counts, and timestamp for rate limiting and cost management.
            We do not store the full text of AI prompts or responses beyond the
            temporary analysis cache.
          </p>

          <h3 className="font-display text-sm font-semibold text-on-surface mt-4 mb-2">
            Analysis Cache
          </h3>
          <p>
            AI-generated analyses are cached for 24 hours (draft) or 7 days
            (cheatsheet) to reduce costs and improve response times. Cached data is
            keyed by team composition, not by user identity.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            3. Third-Party Services
          </h2>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li>
              <strong>Supabase</strong> &mdash; Authentication and database hosting.
              Your data is stored in Supabase&apos;s infrastructure. See{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline"
              >
                Supabase Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Anthropic (Claude API)</strong> &mdash; AI analysis features
              send team composition data to Anthropic&apos;s API for processing. See{" "}
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline"
              >
                Anthropic Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Vercel</strong> &mdash; Application hosting. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline"
              >
                Vercel Privacy Policy
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            4. Data Security
          </h2>
          <p>
            All data is transmitted over HTTPS. User data is protected by Supabase
            Row Level Security (RLS), ensuring users can only access their own data.
            Authentication tokens use industry-standard JWT with ES256 signing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            5. Data Retention
          </h2>
          <p>
            Your account data and user-created content are retained as long as your
            account exists. AI usage logs are retained for operational purposes. If
            you delete your account, your user-created data will be removed.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            6. Cookies
          </h2>
          <p>
            PokeComp uses localStorage for onboarding tour state and session
            management. We do not use tracking cookies or third-party analytics.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            7. Your Rights
          </h2>
          <p>
            You can view, export, or delete your data at any time through the
            application. For data deletion requests or privacy questions, contact the
            developer via the project&apos;s GitHub repository.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-3">
            8. Changes to This Policy
          </h2>
          <p>
            We may update this policy as the service evolves. Significant changes will
            be noted on this page with an updated date.
          </p>
        </section>
      </div>
    </div>
  );
}
