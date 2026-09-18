import { Status, TableCell, TableRow } from "@repo/ui";
import type { ReactElement } from "react";

function LoadingRow({ columnCount }: Readonly<{ columnCount: number }>): ReactElement {
  return (
    <TableRow>
      <TableCell colSpan={columnCount}>
        <Status variant="pending">読み込み中です。</Status>
      </TableCell>
    </TableRow>
  );
}

export { LoadingRow };
