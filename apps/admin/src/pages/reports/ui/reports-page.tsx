import { MockDataTable, MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const columns = ["理由", "対象", "状態", "受付日"] as const;
const rows = [
  ["迷惑行為", "佐藤", "未処置", "2026/9/18"],
  ["なりすまし", "高橋", "調査中", "2026/9/17"],
] as const;

function ReportsPage(): ReactElement {
  return (
    <MockPage title="通報">
      <MockDataTable columns={columns} rows={rows} />
    </MockPage>
  );
}

export { ReportsPage };
