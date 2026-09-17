import { expect, waitFor } from "storybook/test";
import { SignUpFields } from "./signup-fields";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    onSent: noop,
  },
  component: SignUpFields,
});

export const Empty = meta.story();

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: noop } },
});

export const RejectsShortPassword = meta.story({
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "color-contrast" }] } } },
  play: async ({ canvas, canvasElement }) => {
    const { page, userEvent } = await import("vite-plus/test/browser/context");
    const rendered = page.elementLocator(canvasElement);
    await userEvent.fill(rendered.getByLabelText("ユーザー名"), "山田 太郎");
    await userEvent.fill(rendered.getByLabelText("メールアドレス"), "taro@example.com");
    await userEvent.fill(rendered.getByLabelText("パスワード（12文字以上）"), "short");
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvas.getByText("文字数が足りません。")).toBeInTheDocument();
    });
  },
});
