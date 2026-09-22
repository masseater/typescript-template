import { Effect } from "effect";
import { expect, userEvent } from "storybook/test";

import preview, { playTask } from "../storybook/preview";
import { TotpEnrollment } from "./totp-enrollment";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: () => undefined },
    enrollment: {
      backupCodes: ["4f2a-91bc", "7d10-5e33", "a8c4-2b70", "ee91-6d45", "1b77-c082"],
      totpURI: "otpauth://totp/template:taro@example.com?secret=JBSWY3DPEHPK3PXP&issuer=template",
    },
    onVerified: () => undefined,
  },
  component: TotpEnrollment,
});

export const Default = meta.story();

export const UnlocksVerifyAfterSaving = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* unlockVerifyAfterSaving() {
        yield* playTask(() =>
          expect(canvas.getByRole("button", { name: "確認して認証アプリを有効化" })).toBeDisabled(),
        );
        yield* playTask(() => userEvent.click(canvas.getByRole("checkbox")));
        yield* playTask(() =>
          expect(canvas.getByRole("button", { name: "確認して認証アプリを有効化" })).toBeEnabled(),
        );
      }),
    ),
});
