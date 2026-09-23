import { noop } from "es-toolkit";

import preview from "../../../storybook/preview";
import { ActionStatus } from "./action-status";

const meta = preview.meta({
  args: { action: { blocked: false, error: undefined, pending: false, run: noop } },
  component: ActionStatus,
});

export const Idle = meta.story();

export const Pending = meta.story({
  args: {
    action: { blocked: true, error: undefined, pending: true, run: noop },
    pendingMessage: "認証を処理しています。",
  },
});

export const Notice = meta.story({ args: { notice: "パスキーを登録しました。" } });

export const Failed = meta.story({
  args: {
    action: {
      blocked: false,
      error: "認証サーバーが操作を拒否しました。",
      pending: false,
      run: noop,
    },
  },
});
