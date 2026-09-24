import { TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

import type { ReactTable, RowData, TableFeatures } from "@tanstack/react-table";
import type { ReactElement } from "react";

function FlexTableHeader<TFeatures extends TableFeatures, TData extends RowData>({
  table,
}: Readonly<{ table: ReactTable<TFeatures, TData> }>): ReactElement {
  return (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead key={header.id}>
              {header.isPlaceholder ? null : <table.FlexRender header={header} />}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );
}

function FlexTableRows<TFeatures extends TableFeatures, TData extends RowData>({
  table,
}: Readonly<{ table: ReactTable<TFeatures, TData> }>): ReactElement {
  return (
    <>
      {table.getRowModel().rows.map((row) => (
        <TableRow key={row.id}>
          {row.getAllCells().map((cell) => (
            <TableCell key={cell.id}>
              <table.FlexRender cell={cell} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export { FlexTableHeader, FlexTableRows };
