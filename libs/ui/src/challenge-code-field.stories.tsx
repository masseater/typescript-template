import { ChallengeCodeField } from "./challenge-code-field";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { code: { handleChange: noop, value: "" } },
  component: ChallengeCodeField,
});

export const Totp = meta.story({ args: { backup: false } });

export const BackupCode = meta.story({ args: { backup: true } });
