import { Status } from "./status";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Status });

export const Info = meta.story({ args: { children: "認証アプリは未設定です。" } });

export const Success = meta.story({
  args: { children: "パスキーを登録しました。", variant: "success" },
});

export const Error = meta.story({
  args: { children: "認証サーバーが操作を拒否しました。", variant: "error" },
});

export const Pending = meta.story({
  args: { children: "認証設定を更新しています。", variant: "pending" },
});
