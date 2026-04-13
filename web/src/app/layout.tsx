import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/nav";
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

export const metadata: Metadata = {
  title: "Pokemon Champions Companion",
  description: "Personal companion app for competitive Pokemon Champions",
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
      <body className="min-h-full flex flex-col" style={{ perspective: "1000px" }}>
        <Providers>
          <div className="dynamic-void" />
          <Nav />
          <main className="flex-1 flex flex-col items-center w-full relative z-10" style={{ transformStyle: "preserve-3d" }}>
            {children}
          </main>
          <footer className="px-6 py-4 text-center">
            <p className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Pokemon Champions Companion is a fan project. Not affiliated with
              or endorsed by The Pokemon Company, Nintendo, or Game Freak.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
