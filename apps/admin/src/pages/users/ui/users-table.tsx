import { Table, TableBody } from "@repo/ui";
import type { ListedUser } from "#pages/users/model/user-list.ts";
import { LoadingRow } from "./loading-row.tsx";
import type { ReactElement } from "react";
import { UserRow } from "./user-row.tsx";
import { UsersTableHeader } from "./users-table-header.tsx";
import { usersTableColumns } from "#pages/users/model/users-table-columns.ts";

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
