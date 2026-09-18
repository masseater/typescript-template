import { TableHead, TableHeader, TableRow } from "@template/ui";

import { usersTableColumns } from "#pages/users/model/users-table-columns.ts";

import type { ReactElement } from "react";

const UsersTableHeader = (): ReactElement => {
  return (
    <TableHeader>
      <TableRow>
        {usersTableColumns.map((column) => (
          <TableHead key={column}>{column}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
};

export { UsersTableHeader };
