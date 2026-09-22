import preview from "../../../storybook/preview";
import { CredentialsForm } from "./credentials-form";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: () => undefined },
    email: { handleChange: () => undefined, value: "" },
    onAuthenticated: () => undefined,
    onChallenge: () => undefined,
    password: { handleChange: () => undefined, value: "" },
  },
  component: CredentialsForm,
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: {
    email: { handleChange: () => undefined, value: "taro@example.com" },
    password: { handleChange: () => undefined, value: "correct horse battery" },
  },
});

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: () => undefined } },
});
