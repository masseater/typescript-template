import { TableHead, TableHeader, TableRow } from "@template/ui";
import type { ReactElement } from "react";
import { usersTableColumns } from "#users-table-columns.ts";

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
