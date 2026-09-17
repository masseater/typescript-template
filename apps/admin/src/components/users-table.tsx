import type { ManagedUser, MutationMethod } from "#user-management.ts";
import { Table, TableBody } from "@template/ui/ui";
import type { ReactElement } from "react";
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
      <TableBody>
        {users.map((user) => (
          <UserRow key={user.id} user={user} pending={pending} onMutation={onMutation} />
        ))}
      </TableBody>
    </Table>
  );
}

export { UsersTable };
