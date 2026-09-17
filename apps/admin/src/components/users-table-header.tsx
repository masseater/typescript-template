import type { ReactElement } from "react";
import { Th } from "smarthr-ui";

function UsersTableHeader(): ReactElement {
  return (
    <thead>
      <tr>
        <Th>ユーザー名</Th>
        <Th>メールアドレス</Th>
        <Th>メール確認</Th>
        <Th>権限</Th>
        <Th>操作</Th>
      </tr>
    </thead>
  );
}

export { UsersTableHeader };
