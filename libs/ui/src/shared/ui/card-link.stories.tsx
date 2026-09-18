import { CardLink } from "./card-link";
import { Heading } from "./heading";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { children: <Heading size="block">認証設定</Heading>, to: "/" },
  component: CardLink,
});

export const Default = meta.story();
