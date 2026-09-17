import type { ManagedUser, MutationMethod } from "#user-management.ts";
import type { ReactElement } from "react";
import { Table } from "smarthr-ui";
import { UserRow } from "#components/user-row.tsx";
import { UsersTableHeader } from "#components/users-table-header.tsx";

function UsersTable({
  onMutation,
  pending,
  users,
}: Readonly<{
  onMutation: (user: ManagedUser, method: MutationMethod) => void;
  pending: boolean;
  users: readonly ManagedUser[];
}>): ReactElement {
  return (
    <Table>
      <UsersTableHeader />
      <tbody>
        {users.map((user) => (
          <UserRow key={user.id} user={user} pending={pending} onMutation={onMutation} />
        ))}
      </tbody>
    </Table>
  );
}

export { UsersTable };
