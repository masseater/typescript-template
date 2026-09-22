import preview from "../../../storybook/preview";
import { ChallengeForm } from "./challenge-form";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: () => undefined },
    code: { handleChange: () => undefined, value: "" },
    onAuthenticated: () => undefined,
  },
  component: ChallengeForm,
});

export const Totp = meta.story({ args: { mode: "totp" } });

export const BackupCode = meta.story({ args: { mode: "backup" } });

export const Pending = meta.story({
  args: {
    action: { blocked: true, error: undefined, pending: true, run: () => undefined },
    mode: "totp",
  },
});
