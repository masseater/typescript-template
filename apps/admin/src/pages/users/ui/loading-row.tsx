import { STATUS_VARIANT, StatusMessage, TableCell, TableRow } from "@repo/ui";

import type { ReactElement } from "react";

function LoadingRow({ columnCount }: Readonly<{ columnCount: number }>): ReactElement {
  return (
    <TableRow>
      <TableCell colSpan={columnCount}>
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </TableCell>
    </TableRow>
  );
}

export { LoadingRow };
