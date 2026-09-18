import type { ReactElement } from "react";

import { Status, TableCell, TableRow } from "@repo/ui";

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
