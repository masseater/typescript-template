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

const Totp = meta.story({ args: { mode: "totp" } });

const BackupCode = meta.story({ args: { mode: "backup" } });

export { BackupCode, Totp };
