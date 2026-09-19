import { MockDataTable, MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const columns = ["名前", "メールアドレス", "権限"] as const;
const rows = [
  ["運用リード", "ops-lead@example.com", "管理者を追加できる"],
  ["サポート", "support@example.com", "操作できる"],
  ["閲覧担当", "viewer@example.com", "閲覧のみ"],
] as const;

function AdminsPage(): ReactElement {
  return (
    <MockPage title="管理者">
      <MockDataTable columns={columns} rows={rows} />
    </MockPage>
  );
}

export { AdminsPage };
