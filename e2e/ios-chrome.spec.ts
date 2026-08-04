import { expect, test } from "@playwright/test";
import { IOS_DEVICES, seat } from "./helpers";

/**
 * The parts of iOS support that live outside the layout: the viewport
 * declaration, the safe area, Safari's toolbar tint, and the rule that a
 * focused field under 16px makes Safari zoom the whole page.
 */

test("the document declares a cover viewport and a colour for each scheme", async ({
  browser,
}) => {
  const page = await seat(browser, IOS_DEVICES[1]);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const head = await page.evaluate(() => ({
    viewport: document
      .querySelector('meta[name="viewport"]')
      ?.getAttribute("content"),
    themeColors: [
      ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    ].map((tag) => ({ media: tag.media, content: tag.content })),
  }));

  expect(head.viewport).toContain("width=device-width");
  // Without this the page is letterboxed inside the safe area on a notched
  // iPhone and cannot paint edge to edge.
  expect(head.viewport).toContain("viewport-fit=cover");
  expect(head.themeColors.some((tag) => tag.media.includes("light"))).toBe(true);
  expect(head.themeColors.some((tag) => tag.media.includes("dark"))).toBe(true);
});

test("content clears the notch and the home indicator", async ({ browser }) => {
  // iPhone held in landscape: the Dynamic Island takes an edge and the home
  // indicator takes the bottom.
  const page = await seat(browser, IOS_DEVICES[3]);
  const inset = { top: 0, left: 59, bottom: 21, right: 59 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: inset });

  await page.goto("/queue", { waitUntil: "networkidle" });

  const geometry = await page.evaluate(() => {
    const bar = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(
      (nav) => getComputedStyle(nav).position === "fixed",
    );
    return {
      headingLeft: Math.round(
        document.querySelector("h1")!.getBoundingClientRect().left,
      ),
      logoLeft: Math.round(
        document.querySelector("header a")!.getBoundingClientRect().left,
      ),
      barPaddingBottom: bar ? getComputedStyle(bar).paddingBottom : null,
    };
  });

  // Both must start beyond the notch, not merely inside the viewport.
  expect(geometry.headingLeft).toBeGreaterThanOrEqual(inset.left);
  expect(geometry.logoLeft).toBeGreaterThanOrEqual(inset.left);
  if (geometry.barPaddingBottom !== null) {
    expect(parseFloat(geometry.barPaddingBottom)).toBeGreaterThanOrEqual(
      inset.bottom,
    );
  }
});

test("no text field is small enough to make Safari zoom on focus", async ({
  browser,
}) => {
  const page = await seat(browser, IOS_DEVICES[1]);
  for (const path of ["/submit", "/rubric", "/login", "/documents"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const tooSmall = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'input:not([type="checkbox"]):not([type="radio"]), select, textarea',
        ),
      ]
        .filter((field) => parseFloat(getComputedStyle(field).fontSize) < 16)
        .map(
          (field) =>
            `${field.tagName.toLowerCase()} at ${getComputedStyle(field).fontSize}`,
        ),
    );
    expect(tooSmall, `${path} would zoom on focus`).toEqual([]);
  }
});

test("the theme toggle repaints the browser chrome, and hands it back", async ({
  browser,
}) => {
  const page = await seat(browser, { ...IOS_DEVICES[1], colorScheme: "light" });
  await page.goto("/queue", { waitUntil: "networkidle" });

  const readTags = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLMetaElement>(
          'meta[name="theme-color"]',
        ),
      ].map((tag) => ({ media: tag.media, content: tag.content })),
    );

  const atRest = await readTags();
  expect(atRest.every((tag) => tag.media !== "")).toBe(true);

  await page.getByRole("button", { name: "Dark theme" }).click();
  const forced = await readTags();
  const surface = await page.evaluate(
    () => getComputedStyle(document.querySelector("header")!).backgroundColor,
  );
  // Overridden: no media conditions left, and matching the header the Safari
  // toolbar sits against.
  expect(forced.every((tag) => tag.media === "")).toBe(true);
  expect(forced.every((tag) => tag.content === surface)).toBe(true);

  await page.getByRole("button", { name: "System theme" }).click();
  const restored = await readTags();
  expect(restored).toEqual(atRest);
});

test("a stored theme survives a reload without a flash of the other one", async ({
  browser,
}) => {
  const page = await seat(browser, { ...IOS_DEVICES[1], colorScheme: "dark" });
  await page.goto("/queue", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Light theme" }).click();
  const afterClick = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  // Read before the bundle can hydrate: the inline script must have already
  // applied the stored choice.
  const afterReload = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  expect(afterReload).toBe(afterClick);
  expect(await page.evaluate(() => localStorage.getItem("cleared-theme"))).toBe(
    "light",
  );
});
