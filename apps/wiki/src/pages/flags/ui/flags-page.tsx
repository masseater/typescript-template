import { MockPage } from "#widgets/mock-page/index.ts";

import type { ReactElement } from "react";

const flags = [
  { enabled: true, key: "new-checkout", label: "新しいチェックアウト" },
  { enabled: false, key: "beta-search", label: "検索ベータ" },
  { enabled: true, key: "invite-only", label: "招待制" },
] as const;

function FlagsPage(): ReactElement {
  return (
    <MockPage title="機能フラグ">
      <ul className="flex flex-col gap-3">
        {flags.map((flag) => (
          <li
            key={flag.key}
            className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-base leading-tight font-bold text-foreground">{flag.label}</p>
              <p className="text-sm leading-tight text-muted-foreground">{flag.key}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm leading-none font-bold ${flag.enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              {flag.enabled ? "オン" : "オフ"}
            </span>
          </li>
        ))}
      </ul>
    </MockPage>
  );
}

export { FlagsPage };
