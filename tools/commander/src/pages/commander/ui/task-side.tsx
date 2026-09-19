import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { TaskPane } from "./task-pane.tsx";

import type { AppState } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

type App = typeof AppState.Type;

function TaskSide({
  connected,
  ledger,
  tasks,
}: Readonly<{
  connected: boolean;
  ledger: App["ledger"];
  tasks: App["tasks"];
}>): ReactElement {
  return (
    <div className="flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
      {connected ? undefined : (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          アプリとの接続が切れました。つなぎ直しています…
        </StatusMessage>
      )}
      {ledger.status === "unreadable" ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          タスクを読めませんでした。bd が動くか確認してください。
        </StatusMessage>
      ) : undefined}
      {tasks === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>タスクを読み込んでいます…</StatusMessage>
      ) : (
        <TaskPane tasks={tasks} />
      )}
    </div>
  );
}

export { TaskSide };
