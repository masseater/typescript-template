import { expect, fn, userEvent } from "storybook/test";
import { Field } from "./field";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ args: { onChange: fn(), value: "" }, component: Field });

export const Text = meta.story({ args: { label: "ユーザー名", name: "name", required: true } });

export const Email = meta.story({
  args: {
    autoComplete: "username",
    label: "メールアドレス",
    name: "email",
    required: true,
    type: "email",
    value: "taro@example.com",
  },
});

export const Password = meta.story({
  args: {
    autoComplete: "current-password",
    label: "パスワード",
    name: "password",
    required: true,
    type: "password",
  },
});

export const ReadOnly = meta.story({
  args: { label: "所属", name: "team", readOnly: true, value: "プラットフォーム" },
});

export const Numeric = meta.story({
  args: {
    autoComplete: "one-time-code",
    inputMode: "numeric",
    label: "確認コード",
    maxLength: 6,
    name: "totp",
    pattern: "[0-9]{6}",
  },
});

export const Types = meta.story({
  args: { label: "ユーザー名", name: "name" },
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByLabelText("ユーザー名"), "た");
    await expect(args.onChange).toHaveBeenCalled();
  },
});
