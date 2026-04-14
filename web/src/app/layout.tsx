import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
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
  title: "PokeComp",
  description: "Competitive Pokemon Champions companion",
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
          <Nav />
          <OnboardingTour />
          <main className="flex-1 flex flex-col items-center w-full relative z-10">
            {children}
          </main>
          <footer className="px-6 py-4 text-center">
            <p className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              PokeComp is a fan project. Not affiliated with
              or endorsed by The Pokemon Company, Nintendo, or Game Freak.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
