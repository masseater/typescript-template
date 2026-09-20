import {
  Button,
  STATUS_VARIANT,
  StatusMessage,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";

import { adminsTableColumns } from "#pages/admins/model/admin-labels.ts";
import { AdminRow } from "./admin-row.tsx";

import type { AdminListState } from "#pages/admins/model/admin-list.ts";
import type { ReactElement } from "react";

function AdminsTable({
  onReload,
  state,
}: Readonly<{ onReload: () => void; state: AdminListState }>): ReactElement {
  if (state.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2">
        <StatusMessage variant={STATUS_VARIANT.failure}>
          一覧を取得できませんでした。{state.message}
        </StatusMessage>
        <Button type="button" onClick={onReload}>
          再試行
        </Button>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {adminsTableColumns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {state.status === "loading" ? (
          <TableRow>
            <TableCell colSpan={adminsTableColumns.length}>
              <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
            </TableCell>
          </TableRow>
        ) : (
          state.admins.map((admin) => (
            <AdminRow key={admin.id} admin={admin} onChanged={onReload} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { AdminsTable };
