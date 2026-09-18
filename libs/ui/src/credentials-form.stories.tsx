import { expect, waitFor } from "storybook/test";
import { CredentialsForm } from "./credentials-form";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    onAuthenticated: noop,
    onChallenge: noop,
  },
  component: CredentialsForm,
});

export const Empty = meta.story();

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: noop } },
});

export const RejectsEmptySubmission = meta.story({
  play: async ({ canvas, canvasElement }) => {
    const { page, userEvent } = await import("vite-plus/test/browser/context");
    const rendered = page.elementLocator(canvasElement);
    await userEvent.click(rendered.getByRole("button", { name: "ログイン" }));
    await waitFor(async () => {
      await expect(
        canvas.getByText("メールアドレスの形式で入力してください。"),
      ).toBeInTheDocument();
      await expect(canvas.getByText("パスワードを入力してください。")).toBeInTheDocument();
    });
  },
});
