import type { ReactElement } from "react";
import { Table } from "./table";
import { TableBody } from "./table-body";
import { TableCell } from "./table-cell";
import { TableRow } from "./table-row";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  component: TableCell,
  render: ({ children }): ReactElement => (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>{children}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
});

const Default = meta.story({ args: { children: "taro@example.com" } });

export { Default };
