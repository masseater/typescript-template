import { Heading } from "./heading";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Heading });

const PageTitle = meta.story({ args: { as: "h1", children: "認証設定", size: "page" } });

const SectionTitle = meta.story({ args: { children: "認証アプリとパスキー", size: "section" } });

const BlockTitle = meta.story({
  args: { as: "h3", children: "バックアップコード", size: "block" },
});

export { BlockTitle, PageTitle, SectionTitle };
