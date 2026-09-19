import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { UsersBody } from "./users-body.tsx";

import type { ReactElement } from "react";

const placeholders = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

function UsersPending(): ReactElement {
  return (
    <UsersBody>
      <StatusMessage variant={STATUS_VARIANT.pending}>ユーザーを読み込んでいます。</StatusMessage>
      <ul aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholders.map((name) => (
          <li key={name} className="h-20 rounded-lg border border-border bg-muted" />
        ))}
      </ul>
    </UsersBody>
  );
}

export { UsersPending };
