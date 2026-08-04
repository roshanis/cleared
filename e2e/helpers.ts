import type { Browser, Page } from "@playwright/test";

/** Real iOS logical viewports, in CSS px, with their device pixel ratios. */
export const IOS_DEVICES = [
  { name: "iPhone SE", width: 375, height: 667, dpr: 2 },
  { name: "iPhone 15 Pro", width: 393, height: 852, dpr: 3 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, dpr: 3 },
  { name: "iPhone 15 landscape", width: 852, height: 393, dpr: 3 },
  { name: "iPad mini portrait", width: 744, height: 1133, dpr: 2 },
  { name: "iPad Pro 11 portrait", width: 834, height: 1194, dpr: 2 },
  { name: "iPad Pro 11 landscape", width: 1194, height: 834, dpr: 2 },
] as const;

/** Below this the bottom tab bar carries navigation; at or above it, the
 *  header rail does. Mirrors the `md` breakpoint the components use. */
export const TAB_BAR_MAX_WIDTH = 768;

/** Every signed-in page an admin can reach, plus the two public ones. */
export const PAGES = [
  "/",
  "/login",
  "/queue",
  "/documents",
  "/dashboard",
  "/submit",
  "/audit",
] as const;

interface SeatOptions {
  width: number;
  height: number;
  dpr?: number;
  /** Touch emulation drives `pointer: coarse`, which gates touch sizing. */
  touch?: boolean;
  colorScheme?: "light" | "dark";
  persona?: string;
}

/**
 * Opens a page at a given device size, signed in as a demo persona. Defaults
 * to the admin seat because it has the most navigation links — the case where
 * the header has the least room to spare.
 */
export async function seat(
  browser: Browser,
  {
    width,
    height,
    dpr = 2,
    touch = true,
    colorScheme = "light",
    persona = "priya",
  }: SeatOptions,
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: touch,
    hasTouch: touch,
    colorScheme,
  });
  const page = await context.newPage();
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  await page.request.post(`${origin}/api/auth/login`, {
    headers: { "Content-Type": "application/json", Origin: origin },
    data: { personaId: persona },
  });
  return page;
}

/** Widest element sticking out past the viewport, for a useful failure message. */
export async function horizontalOverflow(page: Page): Promise<{
  overflow: number;
  culprit: string | null;
}> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const overflow = root.scrollWidth - viewportWidth;
    if (overflow <= 1) return { overflow, culprit: null };
    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > viewportWidth + 1 || box.left < -1) {
        const classes = String(element.className ?? "").slice(0, 80);
        return {
          overflow,
          culprit: `${element.tagName.toLowerCase()}.${classes} (right=${Math.round(box.right)}, viewport=${viewportWidth})`,
        };
      }
    }
    return { overflow, culprit: "unknown" };
  });
}
