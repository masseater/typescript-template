import preview from "../../../storybook/preview";
import { Card } from "./card";
import { Heading } from "./heading";
import { Status } from "./status";

const meta = preview.meta({ component: Card });

export const Default = meta.story({
  args: {
    children: (
      <>
        <Heading size="section">認証アプリ</Heading>
        <Status variant="success">認証アプリは設定済みです。</Status>
      </>
    ),
  },
});
