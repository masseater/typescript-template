import preview from "@repo/ui/storybook/preview";

import { ChallengeLogin } from "./challenge-login";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: () => undefined },
    onAuthenticated: () => undefined,
    onModeChange: () => undefined,
    onRestart: () => undefined,
  },
  component: ChallengeLogin,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });
