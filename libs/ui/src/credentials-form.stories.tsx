import { noop } from "es-toolkit";

import preview from "../storybook/preview";
import { CredentialsForm } from "./credentials-form";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    email: { handleChange: noop, value: "" },
    onAuthenticated: noop,
    onChallenge: noop,
    password: { handleChange: noop, value: "" },
  },
  component: CredentialsForm,
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: {
    email: { handleChange: noop, value: "taro@example.com" },
    password: { handleChange: noop, value: "correct horse battery" },
  },
});

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: noop } },
});
