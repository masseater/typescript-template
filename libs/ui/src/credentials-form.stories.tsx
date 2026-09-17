import { idleAction, pendingAction, textInput } from "./story-fixture";
import { CredentialsForm } from "./credentials-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: idleAction(),
    email: textInput(),
    onAuthenticated: fn(),
    onChallenge: fn(),
    password: textInput(),
  },
  component: CredentialsForm,
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: { email: textInput("taro@example.com"), password: textInput("correct horse battery") },
});

export const Pending = meta.story({ args: { action: pendingAction() } });
