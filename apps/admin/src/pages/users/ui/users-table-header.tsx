import { TableHead, TableHeader, TableRow } from "@repo/ui";

import { usersTableColumns } from "#pages/users/model/users-table-columns.ts";

import type { ReactElement } from "react";

function UsersTableHeader(): ReactElement {
  return (
    <TableHeader>
      <TableRow>
        {usersTableColumns.map((column) => (
          <TableHead key={column}>{column}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export { UsersTableHeader };
