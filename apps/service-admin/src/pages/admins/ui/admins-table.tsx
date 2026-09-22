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
  resultError,
  type RequestResult,
} from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { adminsTableColumns } from "#pages/admins/model/admin-labels.ts";
import { AdminRow } from "./admin-row.tsx";

import type { ListedAdmin } from "#pages/admins/model/admin-list.ts";
import type { ReactElement } from "react";

function AdminsTable({
  listing,
  onReload,
}: Readonly<{
  listing: RequestResult<readonly ListedAdmin[]>;
  onReload: () => void;
}>): ReactElement {
  const failure = resultError(listing);
  if (failure !== undefined) {
    return (
      <div className="flex flex-col items-start gap-2">
        <StatusMessage variant={STATUS_VARIANT.failure}>
          一覧を取得できませんでした。{failure}
        </StatusMessage>
        <Button type="button" onClick={onReload}>
          再試行
        </Button>
      </div>
    );
  }
  const loaded = AsyncResult.isSuccess(listing) && !listing.waiting;
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
        {loaded ? (
          listing.value.map((admin) => (
            <AdminRow key={admin.id} admin={admin} onChanged={onReload} />
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={adminsTableColumns.length}>
              <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export { AdminsTable };
