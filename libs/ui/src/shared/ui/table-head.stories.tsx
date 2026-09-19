import preview from "../../../storybook/preview";
import { Table } from "./table";
import { TableHead } from "./table-head";
import { TableHeader } from "./table-header";
import { TableRow } from "./table-row";

import type { ReactElement } from "react";

const meta = preview.meta({
  component: TableHead,
  render: ({ children }): ReactElement => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{children}</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
  ),
});

export const Default = meta.story({ args: { children: "メールアドレス" } });
