import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { DemoStrip } from "@/components/demo-strip";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Nav } from "@/components/nav";
import { themeInitScript } from "@/components/theme-toggle";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
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
  // Names the tile if someone adds the app to an iPhone/iPad home screen.
  appleWebApp: { title: "Cleared" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paint edge to edge on notched iPhones; the `gutter`/`safe-bottom`
  // utilities put content back inside the safe area, so nothing lands under
  // the Dynamic Island in landscape or the home indicator at the bottom.
  viewportFit: "cover",
  // Colors the Safari toolbar to match the sticky header it sits against.
  // These two follow the OS; the theme toggle overrides them at runtime when
  // the reader has picked a side explicitly.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171a19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable}`}
    >
      <head>
        {/* Applies a stored theme before first paint — no flash of light. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* dvh, not vh: iOS Safari's vh ignores the collapsing toolbar, which
          leaves a screen-height page scrolling by the toolbar's height. */}
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Skip to content
        </a>
        <Nav />
        <DemoStrip />
        <main
          id="main"
          tabIndex={-1}
          className="gutter mx-auto w-full max-w-7xl py-8 focus:outline-none"
        >
          {children}
        </main>
        <MobileTabBar />
      </body>
    </html>
  );
}
