import { UserManagement } from "@/components/user-management";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { listUsers } from "@/lib/store";

export default async function UsersPage() {
  await requireRole("admin");
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
