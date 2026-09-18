import { ChatPane } from "./chat-pane.tsx";
import { LedgerMissing } from "./ledger-missing.tsx";
import type { ReactElement } from "react";
import { Status } from "@repo/ui";
import { TaskSide } from "./task-side.tsx";
import { useView } from "./store.ts";

function App(): ReactElement {
  const view = useView();
  if (view.status === "connecting") {
    return <Status variant="pending">つないでいます…</Status>;
  }
  if (view.status === "invalid") {
    return (
      <Status variant="error">画面を表示できませんでした。アプリを起動し直してください。</Status>
    );
  }
  const { chat, ledger, tasks } = view.app;
  if (ledger.status === "missing") {
    return <LedgerMissing directory={ledger.directory} />;
  }
  return (
    <main className="grid h-dvh grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
      <ChatPane chat={chat} />
      <TaskSide connected={view.connected} ledger={ledger} tasks={tasks} />
    </main>
  );
}

export { App };
