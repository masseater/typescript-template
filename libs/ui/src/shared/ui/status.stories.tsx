import { Status } from "./status";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Status });

const Info = meta.story({ args: { children: "認証アプリは未設定です。" } });

const Success = meta.story({
  args: { children: "パスキーを登録しました。", variant: "success" },
});

const Error = meta.story({
  args: { children: "認証サーバーが操作を拒否しました。", variant: "error" },
  parameters: { a11y: { test: "todo" } },
});

const Pending = meta.story({
  args: { children: "認証設定を更新しています。", variant: "pending" },
});

export { Error, Info, Pending, Success };
