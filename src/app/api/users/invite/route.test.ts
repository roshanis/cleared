import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserByEmail, resetStoreForTests } from "@/lib/store";
import { POST } from "./route";

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

const req = (body: unknown) =>
  new Request("http://localhost/api/users/invite", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/users/invite", () => {
  it("requires a signed-in admin", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    expect((await POST(req({ email: "writer@example.com", role: "author" }))).status).toBe(
      401,
    );

    getSessionMock.mockResolvedValueOnce({ ...adminSession, role: "officer" });
    expect((await POST(req({ email: "writer@example.com", role: "author" }))).status).toBe(
      403,
    );
  });

  it("creates an invited user and is idempotent for the same email and role", async () => {
    const first = await POST(req({ email: "Writer@Example.com", role: "author" }));
    const second = await POST(req({ email: "writer@example.com", role: "author" }));
    const firstBody = (await first.json()) as { user: { id: string; status: string } };
    const secondBody = (await second.json()) as { user: { id: string; status: string } };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody.user.id).toBe(firstBody.user.id);
    expect(firstBody.user.status).toBe("invited");
    expect(await getUserByEmail("writer@example.com")).toMatchObject({
      role: "author",
      status: "invited",
    });
  });
});
