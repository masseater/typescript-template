import { expect, fn, userEvent } from "storybook/test";
import { TotpEnrollment } from "./totp-enrollment";
import { idleAction } from "./story-fixture";
import preview from "../.storybook/preview";

const enrollment = {
  backupCodes: ["4f2a-91bc", "7d10-5e33", "a8c4-2b70", "ee91-6d45", "1b77-c082"],
  totpURI: "otpauth://totp/template:taro@example.com?secret=JBSWY3DPEHPK3PXP&issuer=template",
};

const meta = preview.meta({
  args: { action: idleAction(), enrollment, onVerified: fn() },
  component: TotpEnrollment,
});

const Default = meta.story();

const UnlocksVerifyAfterSaving = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "確認して認証アプリを有効化" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("checkbox"));
    await expect(canvas.getByRole("button", { name: "確認して認証アプリを有効化" })).toBeEnabled();
  },
});

export { Default, UnlocksVerifyAfterSaving };
