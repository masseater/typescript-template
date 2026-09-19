import { MockDataTable, MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const columns = ["件名", "利用者", "状態", "待ち時間"] as const;
const rows = [
  ["請求の確認", "山田", "未対応", "2時間"],
  ["ログインできない", "佐藤", "対応中", "1日"],
  ["退会したい", "鈴木", "未対応", "3日"],
] as const;

function InquiriesPage(): ReactElement {
  return (
    <MockPage title="問い合わせ">
      <MockDataTable columns={columns} rows={rows} />
    </MockPage>
  );
}

export { InquiriesPage };
