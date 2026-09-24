import preview from "../../../storybook/preview";
import { PasskeyRegisterForm } from "./passkey-register-form";
import { settingsContext } from "./settings-context-test-fixture";

const meta = preview.meta({
  args: {
    context: settingsContext(),
    onRegistered: (): Promise<void> => Promise.resolve(),
  },
  component: PasskeyRegisterForm,
});

export const Default = meta.story();

export const RecoveringAdmin = meta.story({
  args: {
    context: settingsContext({ recovery: "1", strong: false, user: { role: "admin" } }),
  },
});
