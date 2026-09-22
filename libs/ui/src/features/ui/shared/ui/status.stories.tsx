import preview from "../../../storybook/preview";
import { StatusMessage } from "./status";
import { STATUS_VARIANT } from "./status-variants.ts";

const meta = preview.meta({ component: StatusMessage });

export const InfoStatus = meta.story({ args: { children: "認証アプリは未設定です。" } });

export const SuccessStatus = meta.story({
  args: { children: "パスキーを登録しました。", variant: STATUS_VARIANT.success },
});

export const FailureStatus = meta.story({
  args: { children: "認証サーバーが操作を拒否しました。", variant: STATUS_VARIANT.failure },
});

export const PendingStatus = meta.story({
  args: { children: "認証設定を更新しています。", variant: STATUS_VARIANT.pending },
});

export const EmptyStatus = meta.story({
  args: { children: "一覧はまだありません。", variant: STATUS_VARIANT.empty },
});
