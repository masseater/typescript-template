import { noop } from "es-toolkit";

import preview from "../.storybook/preview";
import { ChallengeForm } from "./challenge-form";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    code: { handleChange: noop, value: "" },
    onAuthenticated: noop,
  },
  component: ChallengeForm,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });

export const Pending = meta.story({
  args: {
    action: { blocked: true, error: undefined, pending: true, run: noop },
    mode: "totp",
  },
});
