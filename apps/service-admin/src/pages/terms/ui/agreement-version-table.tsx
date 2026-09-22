import {
  NavigationLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatWarekiDate,
} from "@repo/ui";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { DateTime } from "effect";

import { agreementKindLabels, stateLabel } from "#pages/terms/model/agreement-labels.ts";

import type { VersionList } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

type ListedVersion = VersionList["versions"][number];

const versionTableFeatures = tableFeatures({});

const columnHelper = createColumnHelper<typeof versionTableFeatures, ListedVersion>();

function listedVersionRowId(version: ListedVersion): string {
  return version.id;
}

const versionTableColumns = columnHelper.columns([
  columnHelper.accessor("kind", {
    cell: (cellContext) => agreementKindLabels[cellContext.getValue()],
    header: "種類",
  }),
  columnHelper.accessor("version", {
    cell: (cellContext) => (
      <NavigationLink
        params={{ version: cellContext.getValue() }}
        to="/terms/$version"
        variant="item"
      >
        {cellContext.getValue()}
      </NavigationLink>
    ),
    header: "版",
  }),
  columnHelper.accessor("publishedAt", {
    cell: (cellContext) => stateLabel(cellContext.getValue()),
    header: "状態",
    id: "state",
  }),
  columnHelper.accessor("publishedAt", {
    cell: (cellContext) => {
      const publishedAt = cellContext.getValue();
      return publishedAt === null
        ? "—"
        : formatWarekiDate(DateTime.toDate(DateTime.makeUnsafe(publishedAt)));
    },
    header: "公開日",
    id: "publishedOn",
  }),
]);

function AgreementVersionTable({
  versions,
}: Readonly<{ versions: readonly ListedVersion[] }>): ReactElement {
  const table = useTable({
    columns: versionTableColumns,
    data: versions,
    features: versionTableFeatures,
    getRowId: listedVersionRowId,
  });
  return (
    <Table>
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
      <TableBody>
        {table.getRowModel().rows.map((versionRow) => (
          <TableRow key={versionRow.id}>
            {versionRow.getAllCells().map((versionCell) => (
              <TableCell key={versionCell.id}>
                <table.FlexRender cell={versionCell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { AgreementVersionTable };
