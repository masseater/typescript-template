import { TotpVerifyForm } from "./totp-verify-form";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    onVerified: noop,
  },
  component: TotpVerifyForm,
});

export const BackupCodesUnsaved = meta.story({ args: { saved: false } });

export const BackupCodesSaved = meta.story({ args: { saved: true } });

export const Pending = meta.story({
  args: {
    action: { blocked: true, error: undefined, pending: true, run: noop },
    saved: true,
  },
});
