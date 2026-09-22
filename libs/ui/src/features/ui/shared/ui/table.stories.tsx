import preview from "../../../storybook/preview";
import { Table } from "./table";
import { TableBody } from "./table-body";
import { TableCell } from "./table-cell";
import { TableHead } from "./table-head";
import { TableHeader } from "./table-header";
import { TableRow } from "./table-row";

const meta = preview.meta({ component: Table });

export const Default = meta.story({
  args: {
    children: (
      <>
        <TableHeader>
          <TableRow>
            <TableHead>{"ユーザー名"}</TableHead>
            <TableHead>{"メールアドレス"}</TableHead>
            <TableHead>{"権限"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>{"山田 太郎"}</TableCell>
            <TableCell>{"taro@example.com"}</TableCell>
            <TableCell>{"管理者"}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{"鈴木 花子"}</TableCell>
            <TableCell>{"hanako@example.com"}</TableCell>
            <TableCell>{"一般"}</TableCell>
          </TableRow>
        </TableBody>
      </>
    ),
  },
});
