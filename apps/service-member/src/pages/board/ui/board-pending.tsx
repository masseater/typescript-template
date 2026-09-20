import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { BoardBody } from "./board-body.tsx";

import type { ReactElement } from "react";

const placeholders = ["first", "second", "third"] as const;

function BoardPending(): ReactElement {
  return (
    <BoardBody>
      <StatusMessage variant={STATUS_VARIANT.pending}>スレッドを読み込んでいます。</StatusMessage>
      <ul aria-hidden="true" className="flex flex-col gap-3">
        {placeholders.map((name) => (
          <li key={name} className="h-16 rounded-lg border border-border bg-muted" />
        ))}
      </ul>
    </BoardBody>
  );
}

export { BoardPending };
