import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useView } from "#pages/commander/model/view.ts";
import { ChatPane } from "./chat-pane.tsx";
import { LedgerMissing } from "./ledger-missing.tsx";
import { TaskSide } from "./task-side.tsx";

import type { ReactElement } from "react";

function CommanderPage(): ReactElement {
  const view = useView();
  if (view.status === "connecting") {
    return <StatusMessage variant={STATUS_VARIANT.pending}>つないでいます…</StatusMessage>;
  }
  if (view.status === "invalid") {
    return (
      <StatusMessage variant={STATUS_VARIANT.failure}>
        画面を表示できませんでした。アプリを起動し直してください。
      </StatusMessage>
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

export { CommanderPage };
