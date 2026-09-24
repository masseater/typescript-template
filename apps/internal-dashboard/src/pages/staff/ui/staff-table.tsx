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

import { staffTableColumns } from "#pages/staff/model/staff-labels.ts";
import { StaffRow } from "./staff-row.tsx";

import type { ListedStaff } from "#pages/staff/model/staff-list.ts";
import type { ReactElement } from "react";

function StaffTable({
  listing,
  onReload,
}: Readonly<{
  listing: RequestResult<readonly ListedStaff[]>;
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
          {staffTableColumns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loaded ? (
          listing.value.map((member) => (
            <StaffRow key={member.id} member={member} onChanged={onReload} />
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={staffTableColumns.length}>
              <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export { StaffTable };
