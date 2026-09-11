"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Role } from "@/lib/session";
import type { UserRecord, UserStatus } from "@/lib/store";
import {
  StatusBadge,
  TableCard,
  Th,
  absoluteTime,
  buttonClass,
  fieldLabelClass,
  inputClass,
  selectClass,
} from "./ui";

const roles: Role[] = ["author", "officer", "admin", "auditor"];

interface Draft {
  displayName: string;
  role: Role;
}

export function UserManagement({ users }: { users: UserRecord[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");
  const [drafts, setDrafts] = useState(() => draftFromUsers(users));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const serverRef = useRef(draftFromUsers(users));

  /* Refreshing after one row is saved used to rebuild every draft from the
     server, silently throwing away edits typed into the other rows. Only a
     row the server actually changed is overwritten now. */
  useEffect(() => {
    const next = draftFromUsers(users);
    setDrafts((current) => {
      const merged: Record<string, Draft> = {};
      for (const [id, fromServer] of Object.entries(next)) {
        const previous = serverRef.current[id];
        const local = current[id];
        const serverChanged =
          !previous ||
          previous.displayName !== fromServer.displayName ||
          previous.role !== fromServer.role;
        merged[id] = !local || serverChanged ? fromServer : local;
      }
      return merged;
    });
    serverRef.current = next;
  }, [users]);

  const mutate = (
    url: string,
    opts: {
      method: "POST" | "PATCH";
      body: unknown;
      success: string;
      onSuccess?: () => void;
    },
  ) => {
    setError(null);
    setNotice(null);
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
      setNotice(opts.success);
      router.refresh();
    });
  };

  const invite = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    mutate("/api/users/invite", {
      method: "POST",
      body: { email: address, role },
      success: `Invited ${address} as ${role}.`,
      onSuccess: () => {
        setEmail("");
        setRole("author");
      },
    });
  };

  const update = (
    user: UserRecord,
    patch: Partial<UserRecord>,
    success: string,
  ) => {
    setConfirming(null);
    mutate(`/api/users/${user.id}`, { method: "PATCH", body: patch, success });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={invite}
        className="rounded-lg border border-line bg-surface p-4"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
          <label>
            <span className={fieldLabelClass}>Email</span>
            <input
              className={inputClass}
              type="email"
              required
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
          {/* A submit button, so Enter in the email field invites too. */}
          <button
            type="submit"
            className={buttonClass("primary")}
            disabled={isPending || !email.trim()}
          >
            {isPending ? "Working…" : "Invite user"}
          </button>
        </div>
      </form>

      {/* Every mutation here is invisible otherwise — the table redraws to the
          same shape whether the write landed or not. */}
      <div aria-live="polite" className="sr-only">
        {notice}
      </div>
      {notice && (
        <p className="rounded-md border border-pass/25 bg-pass-soft px-3.5 py-2.5 text-sm font-medium text-pass">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-fail/25 bg-fail-soft px-3.5 py-2.5 text-sm font-medium text-fail"
        >
          {error}
        </p>
      )}

      <TableCard label="Users">
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
              /* Compare trimmed: the PATCH schema is z.string().trim(), so a
                 stray trailing space is saved as a no-op and the row would
                 otherwise read as unsaved forever. */
              const dirty =
                draft.displayName.trim() !== user.displayName ||
                draft.role !== user.role;
              return (
                <tr
                  key={user.id}
                  className="align-top transition-colors duration-150 hover:bg-rail/60"
                >
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <input
                      className={inputClass}
                      aria-label={`Display name for ${user.email}`}
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
                      aria-label={`Role for ${user.email}`}
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
                    {/* UTC, not the reader's locale: this renders on the
                        server too, and a locale-formatted date differs
                        between the two and breaks hydration. */}
                    <time
                      dateTime={user.createdAt}
                      title={absoluteTime(user.createdAt)}
                    >
                      {user.createdAt.slice(0, 10)}
                    </time>
                  </td>
                  <td className="px-4 py-3">
                    {confirming === user.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-fail">
                          Deactivate {user.displayName}?
                        </span>
                        <button
                          type="button"
                          className={buttonClass("danger", "sm")}
                          onClick={() =>
                            update(
                              user,
                              { status: "deactivated" },
                              `Deactivated ${user.displayName}. They can no longer sign in.`,
                            )
                          }
                          disabled={isPending}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className={buttonClass("ghost", "sm")}
                          onClick={() => setConfirming(null)}
                          disabled={isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className={buttonClass(
                            dirty ? "primary" : "secondary",
                            "sm",
                          )}
                          onClick={() =>
                            update(
                              user,
                              {
                                displayName: draft.displayName.trim(),
                                role: draft.role,
                              },
                              `Saved ${draft.displayName.trim()}.`,
                            )
                          }
                          disabled={
                            isPending || !dirty || !draft.displayName.trim()
                          }
                        >
                          {dirty ? "Save changes" : "Saved"}
                        </button>
                        {user.status === "deactivated" ? (
                          <button
                            type="button"
                            className={buttonClass("secondary", "sm")}
                            onClick={() =>
                              update(
                                user,
                                { status: "active" },
                                `Reactivated ${user.displayName}.`,
                              )
                            }
                            disabled={isPending}
                          >
                            Reactivate
                          </button>
                        ) : (
                          /* Deactivation locks someone out of the app; ask
                             once rather than acting on a stray click. */
                          <button
                            type="button"
                            className={buttonClass("danger", "sm")}
                            onClick={() => setConfirming(user.id)}
                            disabled={isPending}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    )}
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

function draftFromUsers(users: UserRecord[]): Record<string, Draft> {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      { displayName: user.displayName, role: user.role },
    ]),
  );
}

function statusTone(status: UserStatus): "neutral" | "pass" | "fail" | "warn" {
  if (status === "active") return "pass";
  if (status === "deactivated") return "fail";
  return "warn";
}
