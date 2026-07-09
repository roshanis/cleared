import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetStoreForTests } from "@/lib/store";
import { GET } from "./route";

const getSessionMock = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: () => getSessionMock(),
}));

const adminSession = {
  personaId: "usr_admin",
  userId: "usr_admin",
  name: "Ada Admin",
  email: "admin@example.com",
  role: "admin",
  authMethod: "oauth",
  gen: 0,
};

beforeEach(async () => {
  await resetStoreForTests(false);
  getSessionMock.mockResolvedValue(adminSession);
});

const req = () =>
  new Request("http://localhost/api/users", {
    headers: { origin: "http://localhost" },
  });

describe("GET /api/users", () => {
  it("requires a signed-in admin", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(401);

    getSessionMock.mockResolvedValueOnce({ ...adminSession, role: "officer" });
    expect((await GET(req())).status).toBe(403);
  });

  it("returns users with role, status, and createdAt", async () => {
    await createUser({
      id: "usr_writer",
      email: "writer@example.com",
      displayName: "Wendy Writer",
      role: "author",
      status: "invited",
      sessionGen: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET(req());
    const body = (await res.json()) as {
      users: Array<{ email: string; role: string; status: string; createdAt: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.users).toEqual([
      expect.objectContaining({
        email: "writer@example.com",
        role: "author",
        status: "invited",
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    ]);
  });
});
