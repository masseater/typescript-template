import { useSessionUser } from "@repo/auth-ui";
import { ADMIN_PERMISSION, grantsAdminLevel } from "@repo/config";
import { LoadingRow, NavigationLink, Table, TableBody } from "@repo/ui";
import { createColumnHelper, metaHelper, tableFeatures, useTable } from "@tanstack/react-table";

import { accountStateLabels, verificationLabels } from "#pages/users/model/user-labels.ts";
import { FlexTableHeader, FlexTableRows } from "#shared/ui/flex-table.tsx";
import { UserRowActions } from "./user-row-actions.tsx";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

interface UsersTableMeta {
  readonly handleChanged: () => void;
  readonly operator: boolean;
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
  columnHelper.accessor("accountState", {
    cell: (cellContext) => accountStateLabels[cellContext.getValue()],
    header: "状態",
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
      if (!tableMeta.operator) {
        return null;
      }
      return <UserRowActions onChanged={tableMeta.handleChanged} user={cellContext.row.original} />;
    },
    header: "操作",
    id: "actions",
  }),
]);

function UsersTable({
  onChanged,
  users,
}: Readonly<{ onChanged: () => void; users: readonly ListedUser[] | undefined }>): ReactElement {
  const { permission } = useSessionUser();
  const operator = grantsAdminLevel(permission, ADMIN_PERMISSION.operator);
  const table = useTable({
    columns: usersTableColumns,
    data: users ?? emptyListedUsers,
    features: usersTableFeatures,
    getRowId: listedUserRowId,
    meta: { handleChanged: onChanged, operator },
  });
  return (
    <Table>
      <FlexTableHeader table={table} />
      <TableBody>
        {users === undefined ? (
          <LoadingRow columnCount={table.getAllLeafColumns().length} />
        ) : (
          <FlexTableRows table={table} />
        )}
      </TableBody>
    </Table>
  );
}

export { UsersTable };
