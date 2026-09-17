import { Table, TableBody } from "@template/ui";
import type { ListedUser } from "#user-list.ts";
import { LoadingRow } from "#components/loading-row.tsx";
import type { ReactElement } from "react";
import { UserRow } from "#components/user-row.tsx";
import { UsersTableHeader } from "#components/users-table-header.tsx";
import { usersTableColumns } from "#users-table-columns.ts";

function UsersTable({
  onChanged,
  users,
}: Readonly<{ onChanged: () => void; users: readonly ListedUser[] | undefined }>): ReactElement {
  return (
    <Table>
      <UsersTableHeader />
      <TableBody>
        {users === undefined ? (
          <LoadingRow columnCount={usersTableColumns.length} />
        ) : (
          users.map((user) => <UserRow key={user.id} user={user} onChanged={onChanged} />)
        )}
      </TableBody>
    </Table>
  );
}

export { UsersTable };
