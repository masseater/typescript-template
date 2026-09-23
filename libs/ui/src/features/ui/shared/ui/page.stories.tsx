import preview from "../../../../../storybook/preview";
import { Page } from "./page";
import { StatusMessage } from "./status";

const meta = preview.meta({ component: Page, parameters: { layout: "fullscreen" } });

export const Default = meta.story({
  args: {
    children: <StatusMessage>{"登録済みのパスキーはありません。"}</StatusMessage>,
    title: "認証設定",
  },
});

export const Full = meta.story({
  args: {
    children: <StatusMessage>{"通報はありません。"}</StatusMessage>,
    layout: "full",
    title: "通報",
  },
});
