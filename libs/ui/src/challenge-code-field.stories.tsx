import { ChallengeCodeField } from "./challenge-code-field";
import preview from "../.storybook/preview";
import { textInput } from "./story-fixture";

const meta = preview.meta({ args: { code: textInput() }, component: ChallengeCodeField });

export const Totp = meta.story({ args: { backup: false } });

export const BackupCode = meta.story({ args: { backup: true } });
