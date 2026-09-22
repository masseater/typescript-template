import preview from "../../../storybook/preview";
import { Table } from "./table";
import { TableHead } from "./table-head";
import { TableHeader } from "./table-header";
import { TableRow } from "./table-row";

import type { ReactElement } from "react";

const meta = preview.meta({
  component: TableHeader,
  render: ({ children }): ReactElement => (
    <Table>
      <TableHeader>{children}</TableHeader>
    </Table>
  ),
});

export const Default = meta.story({
  args: {
    children: (
      <TableRow>
        <TableHead>{"ユーザー名"}</TableHead>
        <TableHead>{"権限"}</TableHead>
      </TableRow>
    ),
  },
});
