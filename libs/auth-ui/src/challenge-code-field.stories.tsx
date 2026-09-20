import preview from "@repo/ui/storybook/preview";

import { ChallengeCodeField } from "./challenge-code-field";

const meta = preview.meta({
  args: { code: { handleChange: () => undefined, value: "" } },
  component: ChallengeCodeField,
});

export const Totp = meta.story({ args: { backup: false } });

export const BackupCode = meta.story({ args: { backup: true } });
