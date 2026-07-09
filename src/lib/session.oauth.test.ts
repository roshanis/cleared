import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cookies } from "next/headers";
import { auth } from "../../auth";
import { createUser, resetStoreForTests, updateUser } from "./store";
import { getSession } from "./session";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("../../auth", () => ({
  auth: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);
const mockedAuth = auth as unknown as Mock;

beforeEach(async () => {
  await resetStoreForTests(false);
  vi.stubEnv("AUTH_GOOGLE_ID", "google-id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "google-secret");
  mockedCookies.mockResolvedValue({
    get: () => undefined,
  } as Awaited<ReturnType<typeof cookies>>);
  mockedAuth.mockReset();
});

describe("getSession OAuth user-record validation", () => {
  it("returns null when a live OAuth session is deactivated", async () => {
    await createUser({
      id: "usr_writer",
      email: "writer@example.com",
      displayName: "Wendy Writer",
      role: "author",
      status: "active",
      sessionGen: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    await updateUser("usr_writer", { status: "deactivated" });
    mockedAuth.mockResolvedValue({
      userId: "usr_writer",
      personaId: "usr_writer",
      name: "Wendy Writer",
      email: "writer@example.com",
      role: "author",
      authMethod: "oauth",
      gen: 0,
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when session generation no longer matches the user record", async () => {
    await createUser({
      id: "usr_writer",
      email: "writer@example.com",
      displayName: "Wendy Writer",
      role: "author",
      status: "active",
      sessionGen: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    await updateUser("usr_writer", { sessionGen: 1 });
    mockedAuth.mockResolvedValue({
      userId: "usr_writer",
      personaId: "usr_writer",
      name: "Wendy Writer",
      email: "writer@example.com",
      role: "author",
      authMethod: "oauth",
      gen: 0,
    });

    await expect(getSession()).resolves.toBeNull();
  });
});
