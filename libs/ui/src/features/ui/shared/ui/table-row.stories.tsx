import preview from "../../../../../storybook/preview";
import { Table } from "./table";
import { TableBody } from "./table-body";
import { TableCell } from "./table-cell";
import { TableRow } from "./table-row";

import type { ReactElement } from "react";

const meta = preview.meta({
  component: TableRow,
  render: ({ children }): ReactElement => (
    <Table>
      <TableBody>
        <TableRow>{children}</TableRow>
      </TableBody>
    </Table>
  ),
});

export const Default = meta.story({
  args: {
    children: (
      <>
        <TableCell>{"山田 太郎"}</TableCell>
        <TableCell>{"管理者"}</TableCell>
      </>
    ),
  },
});
