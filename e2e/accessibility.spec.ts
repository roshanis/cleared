import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seat } from "./helpers";

/**
 * WCAG 2.1 AA sweep with axe, as every persona, in both colour schemes, at a
 * phone and a tablet size. The layout specs check geometry; this is what
 * catches contrast and ARIA regressions, which a redesign touching every page
 * can introduce without a single layout test noticing.
 */

const PERSONAS = ["maya", "devon", "priya", "sam"] as const;
const SCHEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "phone", width: 393, height: 852, dpr: 3, touch: true },
  { name: "tablet", width: 1194, height: 834, dpr: 2, touch: true },
] as const;

const PAGES = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/queue",
  "/documents",
  "/dashboard",
  "/submit",
  "/audit",
  "/rubric",
] as const;

type Violation = { page: string; rule: string; impact: string | null; targets: string[] };

async function scan(page: Page, path: string): Promise<Violation[]> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Redirected pages (a persona without access) are scanned where they land.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map((v) => ({
    page: `${path} → ${new URL(page.url()).pathname}`,
    rule: v.id,
    impact: v.impact ?? null,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
}

/** The first document this persona can open, so the detail page is covered too. */
async function firstDocumentPath(page: Page): Promise<string | null> {
  await page.goto("/documents");
  const href = await page
    .locator('a[href^="/documents/doc_"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  return href;
}

for (const persona of PERSONAS) {
  for (const colorScheme of SCHEMES) {
    test(`axe: ${persona}, ${colorScheme}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const found: Violation[] = [];
      for (const vp of VIEWPORTS) {
        const page = await seat(browser, { ...vp, colorScheme, persona });
        const detail = await firstDocumentPath(page);
        for (const path of detail ? [...PAGES, detail] : PAGES) {
          for (const v of await scan(page, path)) found.push({ ...v, page: `${vp.name} ${v.page}` });
        }
        await page.context().close();
      }
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  }
}
