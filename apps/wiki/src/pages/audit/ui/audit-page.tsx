import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

import { MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const rows = [
  {
    action: "機能フラグ切替",
    actor: "ops-lead@example.com",
    at: "2026/9/19 10:12",
    target: "new-checkout",
  },
  {
    action: "招待送信",
    actor: "ops-lead@example.com",
    at: "2026/9/18 16:40",
    target: "staff@example.com",
  },
] as const;

function AuditPage(): ReactElement {
  return (
    <MockPage title="監査ログ">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>実行者</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.at}-${row.action}`}>
                <TableCell>{row.at}</TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell>{row.target}</TableCell>
                <TableCell>{row.actor}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MockPage>
  );
}

export { AuditPage };
