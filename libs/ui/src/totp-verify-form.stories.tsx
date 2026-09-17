import { idleAction, pendingAction } from "./story-fixture";
import { TotpVerifyForm } from "./totp-verify-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), onVerified: fn() },
  component: TotpVerifyForm,
});

export const BackupCodesUnsaved = meta.story({ args: { saved: false } });

export const BackupCodesSaved = meta.story({ args: { saved: true } });

export const Pending = meta.story({ args: { action: pendingAction(), saved: true } });
