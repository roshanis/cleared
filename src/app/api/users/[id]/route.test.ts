import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, getUserById, resetStoreForTests } from "@/lib/store";
import { PATCH } from "./route";

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
  getSessionMock.mockResolvedValue(adminSession);
});

const req = (body: unknown) =>
  new Request("http://localhost/api/users/usr_writer", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });

describe("PATCH /api/users/[id]", () => {
  it("requires a signed-in admin", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    expect(
      (
        await PATCH(req({ status: "deactivated" }), {
          params: Promise.resolve({ id: "usr_writer" }),
        })
      ).status,
    ).toBe(401);

    getSessionMock.mockResolvedValueOnce({ ...adminSession, role: "auditor" });
    expect(
      (
        await PATCH(req({ status: "deactivated" }), {
          params: Promise.resolve({ id: "usr_writer" }),
        })
      ).status,
    ).toBe(403);
  });

  it("bumps sessionGen when deactivating or changing role", async () => {
    const deactivated = await PATCH(req({ status: "deactivated" }), {
      params: Promise.resolve({ id: "usr_writer" }),
    });
    const roleChanged = await PATCH(req({ role: "officer" }), {
      params: Promise.resolve({ id: "usr_writer" }),
    });
    const body = (await roleChanged.json()) as {
      user: { role: string; status: string; sessionGen: number };
    };

    expect(deactivated.status).toBe(200);
    expect(roleChanged.status).toBe(200);
    expect(body.user).toMatchObject({
      role: "officer",
      status: "deactivated",
      sessionGen: 2,
    });
    expect(await getUserById("usr_writer")).toMatchObject({
      role: "officer",
      status: "deactivated",
      sessionGen: 2,
    });
  });
});
