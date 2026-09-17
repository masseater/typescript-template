import { expect, fn, userEvent } from "storybook/test";
import { idleAction, pendingAction } from "./story-fixture";
import { SignUpFields } from "./signup-fields";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), onSent: fn() },
  component: SignUpFields,
});

const Empty = meta.story();

const Pending = meta.story({ args: { action: pendingAction() } });

const Filled = meta.story({
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText("ユーザー名"), "山田 太郎");
    await userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com");
    await userEvent.type(
      canvas.getByLabelText("パスワード（12文字以上）"),
      "correct horse battery",
    );
    await expect(canvas.getByLabelText("メールアドレス")).toHaveValue("taro@example.com");
  },
});

export { Empty, Filled, Pending };
