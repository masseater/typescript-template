import { ChallengeCodeField } from "./challenge-code-field";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const empty = { handleChange: noop, state: { meta: { errors: [] }, value: "" } };

const meta = preview.meta({ args: { field: empty }, component: ChallengeCodeField });

export const Totp = meta.story({ args: { backup: false } });

export const BackupCode = meta.story({ args: { backup: true } });

export const Invalid = meta.story({
  args: {
    backup: false,
    field: {
      handleChange: noop,
      state: {
        meta: { errors: [{ message: "確認コードは 6 桁の数字で入力してください。" }] },
        value: "12",
      },
    },
  },
});
