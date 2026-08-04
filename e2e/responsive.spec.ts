import { expect, test } from "@playwright/test";
import {
  horizontalOverflow,
  IOS_DEVICES,
  PAGES,
  seat,
  TAB_BAR_MAX_WIDTH,
} from "./helpers";

/**
 * Layout on real device sizes. Each assertion here corresponds to a defect the
 * app actually shipped at some point, so a regression is a failure and not a
 * matter of taste.
 */

for (const device of IOS_DEVICES) {
  test.describe(`${device.name} (${device.width}x${device.height})`, () => {
    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ browser }) => {
        const page = await seat(browser, device);
        await page.goto(path, { waitUntil: "networkidle" });
        const { overflow, culprit } = await horizontalOverflow(page);
        expect(
          overflow,
          culprit ? `widest offender: ${culprit}` : undefined,
        ).toBeLessThanOrEqual(1);
      });
    }
  });
}

test.describe("phone navigation", () => {
  const phone = IOS_DEVICES[0]; // iPhone SE — the least room of any target

  test("every destination is visible in the tab bar, not hidden behind a scroll", async ({
    browser,
  }) => {
    const page = await seat(browser, phone);
    await page.goto("/queue", { waitUntil: "networkidle" });

    const bar = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(
        (candidate) => getComputedStyle(candidate).position === "fixed",
      );
      if (!nav) return null;
      const viewportWidth = document.documentElement.clientWidth;
      const items = [...nav.querySelectorAll("a")];
      return {
        displayed: getComputedStyle(nav).display !== "none",
        count: items.length,
        allWithinViewport: items.every((item) => {
          const box = item.getBoundingClientRect();
          return box.width > 0 && box.left >= -0.5 && box.right <= viewportWidth + 0.5;
        }),
        // A tab bar that scrolls would defeat the point of having one.
        scrolls: nav.scrollWidth > nav.clientWidth + 1,
        shortestSide: Math.min(
          ...items.map((item) => Math.round(item.getBoundingClientRect().height)),
        ),
        current: nav.querySelector('[aria-current="page"]')?.textContent?.trim(),
      };
    });

    expect(bar, "no fixed tab bar rendered on a phone").not.toBeNull();
    expect(bar!.displayed).toBe(true);
    expect(bar!.count).toBeGreaterThanOrEqual(2);
    expect(bar!.allWithinViewport).toBe(true);
    expect(bar!.scrolls).toBe(false);
    expect(bar!.shortestSide).toBeGreaterThanOrEqual(44);
    expect(bar!.current).toBe("Queue");
  });

  test("the fixed bar never covers the end of a page", async ({ browser }) => {
    const page = await seat(browser, phone);
    for (const path of ["/queue", "/documents", "/dashboard", "/audit", "/submit"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      // `scroll-behavior: smooth` is on, so ask for an instant jump.
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
      );
      const buried = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(
          (candidate) => getComputedStyle(candidate).position === "fixed",
        );
        if (!nav) return ["no tab bar"];
        const barBox = nav.getBoundingClientRect();
        return [
          ...document.querySelectorAll("main a, main button, main input, main textarea, main select"),
        ]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return (
              box.height > 0 &&
              box.bottom > barBox.top + 1 &&
              box.top < barBox.bottom
            );
          })
          .map((element) => `${element.tagName.toLowerCase()}: ${element.textContent?.trim().slice(0, 30)}`);
      });
      expect(buried, `${path} has controls under the tab bar`).toEqual([]);
    }
  });
});

test.describe("tablet header", () => {
  // The rail was clipped mid-word and overlapped by the theme toggle at these
  // widths, because the header forced a single nowrap row.
  const tablets = IOS_DEVICES.filter((d) => d.width >= TAB_BAR_MAX_WIDTH);

  for (const device of tablets) {
    test(`${device.name}: the link rail keeps clear of the account controls`, async ({
      browser,
    }) => {
      const page = await seat(browser, device);
      await page.goto("/queue", { waitUntil: "networkidle" });

      const header = await page.evaluate(() => {
        const root = document.querySelector("header")!;
        const rail = root.querySelector('nav[aria-label="Primary"]');
        const account = root.querySelector(".ml-auto")!;
        if (!rail || getComputedStyle(rail).display === "none") return null;
        const railBox = rail.getBoundingClientRect();
        return {
          overlapsAccount: railBox.right > account.getBoundingClientRect().left + 0.5,
          // Whatever fits must fit completely — no half-rendered words.
          clippedLinks: [...rail.querySelectorAll("a")]
            .filter((link) => link.getBoundingClientRect().right > railBox.right + 0.5)
            .map((link) => link.textContent?.trim()),
          // A rail that overflows must say so, or the extra links are invisible.
          overflows: rail.scrollWidth > rail.clientWidth + 1,
          fades: getComputedStyle(rail).maskImage !== "none",
          headerHeight: Math.round(root.getBoundingClientRect().height),
        };
      });

      expect(header, `${device.name} should show the header rail`).not.toBeNull();
      expect(header!.overlapsAccount).toBe(false);
      expect(header!.clippedLinks).toEqual([]);
      if (header!.overflows) expect(header!.fades).toBe(true);
      // One row. Two rows means something wrapped that should not have.
      expect(header!.headerHeight).toBeLessThan(90);
    });
  }
});
