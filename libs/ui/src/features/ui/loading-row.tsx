import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";
import { TableCell } from "./shared/ui/table-cell";
import { TableRow } from "./shared/ui/table-row";

import type { ReactElement } from "react";

const LoadingRow = ({ columnCount }: Readonly<{ columnCount: number }>): ReactElement => (
  <TableRow>
    <TableCell colSpan={columnCount}>
      <StatusMessage variant={STATUS_VARIANT.pending}>{"読み込み中です。"}</StatusMessage>
    </TableCell>
  </TableRow>
);

export { LoadingRow };
