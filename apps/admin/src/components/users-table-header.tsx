import { TableHead, TableHeader, TableRow } from "@template/ui/ui";
import type { ReactElement } from "react";

function UsersTableHeader(): ReactElement {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>ユーザー名</TableHead>
        <TableHead>メールアドレス</TableHead>
        <TableHead>メール確認</TableHead>
        <TableHead>権限</TableHead>
        <TableHead>操作</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export { UsersTableHeader };
