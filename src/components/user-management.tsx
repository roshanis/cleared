"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Role } from "@/lib/session";
import type { UserRecord, UserStatus } from "@/lib/store";
import {
  StatusBadge,
  TableCard,
  Th,
  buttonClass,
  fieldLabelClass,
  inputClass,
  selectClass,
} from "./ui";

const roles: Role[] = ["author", "officer", "admin", "auditor"];

export function UserManagement({ users }: { users: UserRecord[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");
  const [drafts, setDrafts] = useState(() => draftFromUsers(users));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setDrafts(draftFromUsers(users)), [users]);

  const invite = () => {
    mutate("/api/users/invite", {
      method: "POST",
      body: { email, role },
      onSuccess: () => {
        setEmail("");
        setRole("author");
      },
    });
  };

  const update = (id: string, patch: Partial<UserRecord>) => {
    mutate(`/api/users/${id}`, {
      method: "PATCH",
      body: patch,
    });
  };

  const mutate = (
    url: string,
    opts: {
      method: "POST" | "PATCH";
      body: unknown;
      onSuccess?: () => void;
    },
  ) => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(url, {
        method: opts.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts.body),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "User update failed.");
        return;
      }
      opts.onSuccess?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
          <label>
            <span className={fieldLabelClass}>Email</span>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="writer@example.com"
              disabled={isPending}
            />
          </label>
          <label>
            <span className={fieldLabelClass}>Role</span>
            <select
              className={selectClass}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              disabled={isPending}
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={invite}
            disabled={isPending || !email.trim()}
          >
            Invite user
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm leading-6 text-fail" role="status">
            {error}
          </p>
        )}
      </div>

      <TableCard>
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-rail">
            <tr>
              <Th>Email</Th>
              <Th>Display name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => {
              const draft = drafts[user.id] ?? {
                displayName: user.displayName,
                role: user.role,
              };
              return (
                <tr
                  key={user.id}
                  className="align-top transition-colors duration-150 hover:bg-rail/60"
                >
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <input
                      className={inputClass}
                      value={draft.displayName}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: {
                            ...draft,
                            displayName: event.target.value,
                          },
                        }))
                      }
                      disabled={isPending}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={selectClass}
                      value={draft.role}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: {
                            ...draft,
                            role: event.target.value as Role,
                          },
                        }))
                      }
                      disabled={isPending}
                    >
                      {roles.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(user.status)}>
                      {user.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={buttonClass("secondary", "sm")}
                        onClick={() =>
                          update(user.id, {
                            displayName: draft.displayName,
                            role: draft.role,
                          })
                        }
                        disabled={isPending || !draft.displayName.trim()}
                      >
                        Save
                      </button>
                      {user.status === "deactivated" ? (
                        <button
                          type="button"
                          className={buttonClass("secondary", "sm")}
                          onClick={() => update(user.id, { status: "active" })}
                          disabled={isPending}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={buttonClass("danger", "sm")}
                          onClick={() =>
                            update(user.id, { status: "deactivated" })
                          }
                          disabled={isPending}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function draftFromUsers(users: UserRecord[]) {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      { displayName: user.displayName, role: user.role },
    ]),
  ) as Record<string, { displayName: string; role: Role }>;
}

function statusTone(status: UserStatus): "neutral" | "pass" | "fail" | "warn" {
  if (status === "active") return "pass";
  if (status === "deactivated") return "fail";
  return "warn";
}
