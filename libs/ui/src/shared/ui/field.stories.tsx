import { expect, waitFor } from "storybook/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import { Field } from "./field";
import { noop } from "es-toolkit";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ args: { onValueChange: noop, value: "" }, component: Field });

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
    label: "パスワード（12文字以上）",
    minLength: 12,
    name: "password",
    type: "password",
    value: undefined,
  },
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "color-contrast" }] } } },
  play: async ({ canvas, canvasElement }) => {
    const rendered = page.elementLocator(canvasElement);
    await userEvent.fill(rendered.getByLabelText("パスワード（12文字以上）"), "short");
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvas.getByText("文字数が足りません。")).toBeInTheDocument();
    });
  },
});

export const Missing = meta.story({
  args: { label: "ユーザー名", name: "name", required: true, value: undefined },
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "color-contrast" }] } } },
  play: async ({ canvas, canvasElement }) => {
    const rendered = page.elementLocator(canvasElement);
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "x");
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "");
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvas.getByText("入力してください。")).toBeInTheDocument();
    });
  },
});
