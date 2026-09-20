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

import { staffTableColumns } from "#pages/staff/model/staff-labels.ts";
import { StaffRow } from "./staff-row.tsx";

import type { StaffListState } from "#pages/staff/model/staff-list.ts";
import type { ReactElement } from "react";

function StaffTable({
  onReload,
  state,
}: Readonly<{ onReload: () => void; state: StaffListState }>): ReactElement {
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
          {staffTableColumns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {state.status === "loading" ? (
          <TableRow>
            <TableCell colSpan={staffTableColumns.length}>
              <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
            </TableCell>
          </TableRow>
        ) : (
          state.staff.map((member) => (
            <StaffRow key={member.id} member={member} onChanged={onReload} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { StaffTable };
