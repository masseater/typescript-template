import { idleAction, pendingAction, textInput } from "./story-fixture";
import { ChallengeForm } from "./challenge-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), code: textInput(), onAuthenticated: fn() },
  component: ChallengeForm,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });

export const Pending = meta.story({ args: { action: pendingAction(), mode: "totp" } });
