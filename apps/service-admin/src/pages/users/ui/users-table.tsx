import {
  NavigationLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { createColumnHelper, metaHelper, tableFeatures, useTable } from "@tanstack/react-table";

import { roleLabels, verificationLabels } from "#pages/users/model/user-labels.ts";
import { LoadingRow } from "./loading-row.tsx";
import { UserRowActions } from "./user-row-actions.tsx";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

interface UsersTableMeta {
  readonly onChanged: () => void;
}

const usersTableFeatures = tableFeatures({
  tableMeta: metaHelper<UsersTableMeta>(),
});

const columnHelper = createColumnHelper<typeof usersTableFeatures, ListedUser>();

const emptyListedUsers: readonly ListedUser[] = [];

function listedUserRowId(user: ListedUser): string {
  return user.id;
}

const usersTableColumns = columnHelper.columns([
  columnHelper.accessor("name", {
    cell: (cellContext) => (
      <NavigationLink params={{ id: cellContext.row.original.id }} to="/members/$id" variant="item">
        {cellContext.getValue()}
      </NavigationLink>
    ),
    header: "名前",
  }),
  columnHelper.accessor("email", { header: "メールアドレス" }),
  columnHelper.accessor("role", {
    cell: (cellContext) => roleLabels[cellContext.getValue()],
    header: "権限",
  }),
  columnHelper.accessor("emailVerified", {
    cell: (cellContext) =>
      cellContext.getValue() ? verificationLabels.true : verificationLabels.false,
    header: "メール確認",
  }),
  columnHelper.accessor("twoFactorEnabled", {
    cell: (cellContext) => (cellContext.getValue() ? "設定済み" : "未設定"),
    header: "2段階認証",
  }),
  columnHelper.accessor("registeredOn", { header: "登録日" }),
  columnHelper.display({
    cell: (cellContext) => {
      const tableMeta = cellContext.table.options.meta;
      if (tableMeta === undefined) {
        throw new Error("利用者一覧の操作を実行できません。");
      }
      return <UserRowActions onChanged={tableMeta.onChanged} user={cellContext.row.original} />;
    },
    header: "操作",
    id: "actions",
  }),
]);

function UsersTable({
  onChanged,
  users,
}: Readonly<{ onChanged: () => void; users: readonly ListedUser[] | undefined }>): ReactElement {
  const table = useTable({
    columns: usersTableColumns,
    data: users ?? emptyListedUsers,
    features: usersTableFeatures,
    getRowId: listedUserRowId,
    meta: { onChanged },
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
        {users === undefined ? (
          <LoadingRow columnCount={table.getAllLeafColumns().length} />
        ) : (
          table.getRowModel().rows.map((userRow) => (
            <TableRow key={userRow.id}>
              {userRow.getAllCells().map((userCell) => (
                <TableCell key={userCell.id}>
                  <table.FlexRender cell={userCell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { UsersTable };
