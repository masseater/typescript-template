import type { ReactElement } from "react";

import { usersTableColumns } from "#pages/users/model/users-table-columns.ts";
import { TableHead, TableHeader, TableRow } from "@repo/ui";

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
