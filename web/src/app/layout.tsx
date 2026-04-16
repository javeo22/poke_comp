import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Nav } from "@/components/nav";
import { OnboardingTour } from "@/components/onboarding-tour";
import { Providers } from "./providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

// All pages fetch data client-side; skip static prerendering to avoid
// build-time fetch failures (relative API_URL is invalid on the server).
export const dynamic = "force-dynamic";

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
      className={`${spaceGrotesk.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Analytics />
          <Nav />
          <OnboardingTour />
          <main className="flex-1 flex flex-col items-center w-full relative z-10">
            {children}
          </main>
          <footer className="px-6 py-5 text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
              <a href="/terms" className="hover:text-on-surface transition-colors">
                Terms
              </a>
              <span className="text-outline-variant">|</span>
              <a href="/privacy" className="hover:text-on-surface transition-colors">
                Privacy
              </a>
              <span className="text-outline-variant">|</span>
              <a href="/support" className="hover:text-on-surface transition-colors">
                Support
              </a>
              <span className="text-outline-variant">|</span>
              <span>
                Data from{" "}
                <a
                  href="https://pokeapi.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-on-surface transition-colors"
                >
                  PokeAPI
                </a>
                {", "}
                <a
                  href="https://pikalytics.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-on-surface transition-colors"
                >
                  Pikalytics
                </a>
                {", "}
                <a
                  href="https://www.smogon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-on-surface transition-colors"
                >
                  Smogon
                </a>
              </span>
            </div>
            <p className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              PokeComp is a fan project. Not affiliated with or endorsed by
              The Pokemon Company, Nintendo, or Game Freak.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
