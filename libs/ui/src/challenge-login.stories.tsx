import { noop } from "es-toolkit";

import preview from "../.storybook/preview";
import { ChallengeLogin } from "./challenge-login";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    onAuthenticated: noop,
    onModeChange: noop,
    onRestart: noop,
  },
  component: ChallengeLogin,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });
