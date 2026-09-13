import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { IOS_DEVICES, seat } from "./helpers";

/**
 * The public-facing surface: what a crawler, a link unfurler and a regulator
 * see. None of this is visible in the app itself, so nothing else would catch
 * it going missing.
 */

const PUBLIC_PAGES = ["/", "/login", "/privacy", "/terms"] as const;
const PRIVATE_PAGES = ["/queue", "/documents", "/dashboard", "/submit", "/audit", "/rubric", "/users"] as const;

test("every page carries its own title and description", async ({ browser }) => {
  const page = await seat(browser, IOS_DEVICES[6]);

  /* Read the HTML directly rather than navigating: a page that redirects
     (e.g. /users for a demo admin) still emits its metadata, but the
     client-side redirect that follows aborts the next navigation. */
  const metaOf = async (path: string) => {
    const res = await page.request.get(path);
    // 404 is the right answer for the not-found page, and it still has to
    // carry a title and a description.
    expect(res.status(), `${path} failed to render`).toBeLessThan(500);
    const html = await res.text();
    return {
      title: /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "",
      description:
        /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "",
    };
  };

  const SITE_DEFAULT = "Fast feedback for writers";
  const generic: string[] = [];

  for (const path of [...PUBLIC_PAGES, ...PRIVATE_PAGES, "/thank-you", "/no-such-page"]) {
    const meta = await metaOf(path);
    expect(meta.title, `${path} has no title`).not.toBe("");
    expect(meta.description, `${path} has no meta description`).not.toBe("");
    // "/" and "/login" legitimately carry the site-wide description.
    if (path !== "/" && path !== "/login" && meta.description.startsWith(SITE_DEFAULT)) {
      generic.push(path);
    }
  }
  expect(generic, "pages still using the site-wide description").toEqual([]);
});

test("robots keeps crawlers out of the compliance record", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();

  for (const path of PRIVATE_PAGES) {
    expect(body, `${path} is not disallowed`).toContain(`Disallow: ${path}`);
  }
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Sitemap:");
});

test("the sitemap lists the public pages and nothing private", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    new URL(m[1]).pathname.replace(/\/$/, "") || "/",
  );

  expect(locs.sort()).toEqual([...PUBLIC_PAGES].sort());
  for (const path of PRIVATE_PAGES) {
    expect(locs, `${path} leaked into the sitemap`).not.toContain(path);
  }
});

test("icons and the social image are all served", async ({ request }) => {
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon", "/opengraph-image"]) {
    const res = await request.get(path);
    expect(res.status(), `${path} is not served`).toBe(200);
    expect(Number(res.headers()["content-length"] ?? 1), `${path} is empty`).toBeGreaterThan(0);
  }
});

test("privacy and terms are reachable from the footer of every page", async ({ browser }) => {
  const page = await seat(browser, IOS_DEVICES[6]);
  for (const path of ["/", "/queue", "/documents", "/privacy"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("footer a")].map((a) => a.getAttribute("href")),
    );
    expect(links, `${path} footer is missing the legal links`).toEqual(
      expect.arrayContaining(["/privacy", "/terms"]),
    );
  }
});

test("no consent banner appears when no analytics is configured", async ({ browser }) => {
  // Asking permission for a strictly necessary session cookie is both
  // unnecessary and corrosive — the banner must stay away by default.
  const page = await seat(browser, IOS_DEVICES[0]);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog", { name: "Analytics cookies" })).toHaveCount(0);
  const thirdParty = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")]
      .map((s) => s.getAttribute("src") ?? "")
      .filter((src) => /^https?:\/\//.test(src) && !src.includes("localhost")),
  );
  expect(thirdParty, "a third-party script loaded with no analytics configured").toEqual([]);
});

test("the phone CTA appears only once the hero button has scrolled away", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: IOS_DEVICES[0].width, height: IOS_DEVICES[0].height },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage(); // signed OUT on purpose
  await page.goto("/", { waitUntil: "networkidle" });

  const cta = page.locator("a#hero-cta");
  await expect(cta).toBeVisible();
  const sticky = page.getByRole("link", { name: "Try the demo" }).nth(1);
  await expect(sticky).toHaveCount(0);

  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" }),
  );
  await expect(page.getByRole("link", { name: "Try the demo" }).last()).toBeVisible();

  const box = await page.getByRole("link", { name: "Try the demo" }).last().boundingBox();
  expect(box!.height, "the sticky CTA is under the 44px touch minimum").toBeGreaterThanOrEqual(44);
  await context.close();
});

test("signing out lands on a confirmation, not the bare sign-in form", async ({
  browser,
}) => {
  const page = await seat(browser, IOS_DEVICES[1]);
  await page.goto("/documents", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('form[action="/api/auth/logout"]');
    form!.submit();
  });
  await page.waitForURL(/\/thank-you/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("signed out");
});
