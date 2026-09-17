import { idleAction, pendingAction } from "./story-fixture";
import { TotpVerifyForm } from "./totp-verify-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), onVerified: fn() },
  component: TotpVerifyForm,
});

const BackupCodesUnsaved = meta.story({ args: { saved: false } });

const BackupCodesSaved = meta.story({ args: { saved: true } });

const Pending = meta.story({ args: { action: pendingAction(), saved: true } });

export { BackupCodesSaved, BackupCodesUnsaved, Pending };
