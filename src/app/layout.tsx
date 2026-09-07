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
  title: siteTitle,
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
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-accent px-4 py-3 text-white focus:not-sr-only">Skip to content</a>
        <Nav />
        <DemoStrip />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
