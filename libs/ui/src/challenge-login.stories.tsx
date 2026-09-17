import { ChallengeLogin } from "./challenge-login";
import { fn } from "storybook/test";
import { idleAction } from "./story-fixture";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: idleAction(),
    onAuthenticated: fn(),
    onModeChange: fn(),
    onRestart: fn(),
  },
  component: ChallengeLogin,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });
