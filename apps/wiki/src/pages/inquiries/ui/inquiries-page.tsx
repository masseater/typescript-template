import { MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const rows = [
  { id: "inq_1", subject: "請求の確認", status: "未対応", waited: "2時間" },
  { id: "inq_2", subject: "ログインできない", status: "対応中", waited: "1日" },
] as const;

function InquiriesPage(): ReactElement {
  return (
    <MockPage title="問い合わせ">
      <p className="text-base leading-normal text-muted-foreground">
        読むだけの画面です。返信は管理者アプリで行います。
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-4 py-3"
          >
            <span className="text-base leading-tight font-bold text-foreground">{row.subject}</span>
            <span className="text-sm leading-tight text-muted-foreground">
              {row.status} · {row.waited}
            </span>
          </li>
        ))}
      </ul>
    </MockPage>
  );
}

export { InquiriesPage };
