import type { ReactElement } from "react";

import type { AppState } from "#contract.ts";
import { Status } from "@repo/ui";

import { TaskPane } from "./task-pane.tsx";

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
        <Status variant="error">アプリとの接続が切れました。つなぎ直しています…</Status>
      )}
      {ledger.status === "unreadable" ? (
        <Status variant="error">タスクを読めませんでした。bd が動くか確認してください。</Status>
      ) : undefined}
      {tasks === undefined ? (
        <Status variant="pending">タスクを読み込んでいます…</Status>
      ) : (
        <TaskPane tasks={tasks} />
      )}
    </div>
  );
}

export { TaskSide };
