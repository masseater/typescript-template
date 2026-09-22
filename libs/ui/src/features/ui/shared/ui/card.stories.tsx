import preview from "../../../storybook/preview";
import { Card } from "./card";
import { Heading } from "./heading";
import { StatusMessage } from "./status";
import { STATUS_VARIANT } from "./status-variants.ts";

const meta = preview.meta({ component: Card });

export const Default = meta.story({
  args: {
    children: (
      <>
        <Heading size="section">{"認証アプリ"}</Heading>
        <StatusMessage variant={STATUS_VARIANT.success}>
          {"認証アプリは設定済みです。"}
        </StatusMessage>
      </>
    ),
  },
});
