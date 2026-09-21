import { noop } from "es-toolkit";
import { expect } from "storybook/test";

import preview from "../../../storybook/preview";
import { Field } from "./field";

const meta = preview.meta({ args: { onValueChange: noop, value: "" }, component: Field });

export const TextField = meta.story({
  args: { label: "ユーザー名", name: "name" },
});

export const Email = meta.story({
  args: {
    autoComplete: "username",
    label: "メールアドレス",
    name: "email",
    type: "email",
    value: "taro@example.com",
  },
});

export const Password = meta.story({
  args: {
    autoComplete: "current-password",
    label: "パスワード",
    name: "password",
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

export const Multiline = meta.story({
  args: {
    label: "認証アプリ登録用 URI",
    multiline: true,
    name: "totp-uri",
    readOnly: true,
    value: "otpauth://totp/template:taro@example.com?secret=JBSWY3DPEHPK3PXP&issuer=template",
  },
});

export const TooShort = meta.story({
  args: {
    error: "文字数が足りません。",
    label: "パスワード（12文字以上）",
    name: "password",
    type: "password",
    value: "short",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("文字数が足りません。")).toBeInTheDocument();
  },
});

export const Missing = meta.story({
  args: { error: "入力してください。", label: "ユーザー名", name: "name", value: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("入力してください。")).toBeInTheDocument();
  },
});
