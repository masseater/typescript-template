import { failedAction, idleAction, pendingAction } from "./story-fixture";
import { ActionStatus } from "./action-status";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { action: idleAction() }, component: ActionStatus });

export const Idle = meta.story();

export const Pending = meta.story({
  args: { action: pendingAction(), pendingMessage: "認証を処理しています。" },
});

export const Notice = meta.story({ args: { notice: "パスキーを登録しました。" } });

export const Failed = meta.story({
  args: { action: failedAction("認証サーバーが操作を拒否しました。") },
  parameters: { a11y: { test: "todo" } },
});
