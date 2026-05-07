import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Nav } from "@/components/nav";
import { OnboardingTour } from "@/components/onboarding-tour";
import { AdSlot } from "@/components/ad-slot";
import { DemoBanner } from "@/components/demo-banner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Static pages (terms, privacy, support) are server components.
// Dynamic pages (cheatsheet, draft, roster) have their own layout with force-dynamic.

export const metadata: Metadata = {
  title: {
    default: "PokeComp - Pokemon Champions Companion",
    template: "%s | PokeComp",
  },
  description:
    "AI-powered competitive Pokemon Champions companion. Roster tracking, team builder, draft analysis, cheatsheets, and meta insights.",
  metadataBase: new URL("https://pokecomp.app"),
  openGraph: {
    title: "PokeComp - Pokemon Champions Companion",
    description:
      "AI-powered draft analysis, team cheatsheets, and meta tracking for competitive Pokemon Champions.",
    url: "https://pokecomp.app",
    siteName: "PokeComp",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PokeComp - Pokemon Champions Companion",
    description:
      "AI-powered draft analysis, team cheatsheets, and meta tracking for competitive Pokemon Champions.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "PokeComp",
              url: "https://pokecomp.app",
              description:
                "AI-powered competitive Pokemon Champions companion for roster tracking, team building, draft analysis, and meta insights.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://pokecomp.app/pokemon?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <Providers>
          <Analytics />
          <Nav />
          <DemoBanner />
          <OnboardingTour />
          <main className="flex-1 flex flex-col items-center w-full relative z-10">
            {children}
          </main>
          <AdSlot />
          <footer className="relative z-10 mt-12 border-t border-outline-variant px-6 py-6 text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-on-surface-muted">
              <a href="/terms" className="hover:text-accent transition-colors">
                Terms
              </a>
              <span className="text-outline-variant">|</span>
              <a href="/privacy" className="hover:text-accent transition-colors">
                Privacy
              </a>
              <span className="text-outline-variant">|</span>
              <a href="/support" className="hover:text-accent transition-colors">
                Support
              </a>
              <span className="text-outline-variant">|</span>
              <span>
                Data from{" "}
                <a
                  href="https://pokeapi.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  PokeAPI
                </a>
                {", "}
                <a
                  href="https://pikalytics.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  Pikalytics
                </a>
                {", "}
                <a
                  href="https://www.smogon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  Smogon
                </a>
              </span>
            </div>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-on-surface-muted">
              A solo fan project. Not affiliated with The Pokemon Company, Nintendo, or Game Freak.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
