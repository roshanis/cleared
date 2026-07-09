import { redirect } from "next/navigation";
import { UserManagement } from "@/components/user-management";
import { PageHeader } from "@/components/ui";
import { canManageUsers } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { listUsers } from "@/lib/store";

export default async function UsersPage() {
  const session = await requireRole("admin");
  // Real user administration is OAuth-admin only; a demo persona (even the
  // admin one) must not reach live user records. See canManageUsers.
  if (!canManageUsers(session)) redirect("/");
  const users = await listUsers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        subtitle="Invite users, assign roles, and deactivate accounts without changing the demo persona flow."
      />
      <UserManagement users={users} />
    </div>
  );
}
