import { MockDataTable, MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const columns = ["版", "状態", "公開日"] as const;
const rows = [
  ["2026.09", "公開中", "2026/9/1"],
  ["2026.06", "過去版", "2026/6/1"],
  ["2026.10", "下書き", "—"],
] as const;

function TermsPage(): ReactElement {
  return (
    <MockPage title="規約">
      <MockDataTable columns={columns} rows={rows} />
    </MockPage>
  );
}

export { TermsPage };
