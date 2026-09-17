import { Page } from "./page";
import { Status } from "./status";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Page, parameters: { layout: "fullscreen" } });

export const Default = meta.story({
  args: { children: <Status>登録済みのパスキーはありません。</Status>, title: "認証設定" },
});
