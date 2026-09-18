import preview from "../../../.storybook/preview";
import { Heading } from "./heading";

const meta = preview.meta({ component: Heading });

export const PageTitle = meta.story({ args: { as: "h1", children: "認証設定", size: "page" } });

export const SectionTitle = meta.story({
  args: { children: "認証アプリとパスキー", size: "section" },
});

export const BlockTitle = meta.story({
  args: { as: "h3", children: "バックアップコード", size: "block" },
});
