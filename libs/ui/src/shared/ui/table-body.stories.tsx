import type { ReactElement } from "react";

import preview from "../../../.storybook/preview";
import { Table } from "./table";
import { TableBody } from "./table-body";
import { TableCell } from "./table-cell";
import { TableRow } from "./table-row";

const meta = preview.meta({
  component: TableBody,
  render: ({ children }): ReactElement => (
    <Table>
      <TableBody>{children}</TableBody>
    </Table>
  ),
});

export const Default = meta.story({
  args: {
    children: (
      <>
        <TableRow>
          <TableCell>山田 太郎</TableCell>
          <TableCell>管理者</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>鈴木 花子</TableCell>
          <TableCell>一般</TableCell>
        </TableRow>
      </>
    ),
  },
});
