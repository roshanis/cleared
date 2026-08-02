import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { DemoStrip } from "@/components/demo-strip";
import { Nav } from "@/components/nav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

const siteTitle = "Cleared — compliance review, before it ships";
const siteDescription =
  "Fast feedback for writers. Full authority for compliance. A complete trail for auditors.";

export const metadata: Metadata = {
  // Pages set their own title; this suffixes them so a tab is identifiable
  // when several are open at once (queue, a document, the audit log).
  title: { default: siteTitle, template: "%s · Cleared" },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: "Cleared",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable}`}
    >
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <Nav />
        <DemoStrip />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-6 py-8 focus:outline-none"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
