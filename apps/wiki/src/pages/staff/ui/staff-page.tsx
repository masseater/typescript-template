import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

import { MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const rows = [
  { email: "ops-lead@example.com", name: "運用リード", permission: "変更できる" },
  { email: "viewer@example.com", name: "閲覧担当", permission: "閲覧のみ" },
] as const;

function StaffPage(): ReactElement {
  return (
    <MockPage title="メンバー">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>権限</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.email}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.permission}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MockPage>
  );
}

export { StaffPage };
