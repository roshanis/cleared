import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite. Everything here asserts something a unit test cannot see:
 * real layout at real device sizes, hit areas, and the document <head>.
 *
 * The app is built and served in demo mode so the specs can seat themselves as
 * any persona without an identity provider. `reuseExistingServer` keeps the
 * local loop fast; CI always starts its own.
 */

const PORT = Number(process.env.E2E_PORT ?? 3123);
// `localhost`, not `127.0.0.1`: requireSameOrigin() compares the Origin header
// against `req.url`, whose host under `next start` is always localhost no
// matter which address the request arrived on, so loopback-by-IP is rejected
// as cross-origin.
export const BASE_URL = `http://localhost:${PORT}`;

// Sandboxes that ship a prebuilt browser point at it here; CI installs a
// matching one via `playwright install` and leaves this unset.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Demo auth is what lets a spec take a seat; the suite asserts nothing
      // about the production identity path.
      DEMO_AUTH: "1",
      DEMO_PUBLIC: "1",
      AUTH_SECRET: "e2e-secret-not-for-production",
    },
  },
});
