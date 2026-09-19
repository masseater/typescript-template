import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

import type { ReactElement } from "react";

function MockDataTable({
  columns,
  rows,
}: Readonly<{
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}>): ReactElement {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells) => (
            <TableRow key={cells.join("\0")}>
              {cells.map((cell) => (
                <TableCell key={`${cells[0]}\0${cell}`}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { MockDataTable };
