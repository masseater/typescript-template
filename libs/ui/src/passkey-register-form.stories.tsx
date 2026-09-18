import { PasskeyRegisterForm } from "./passkey-register-form";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const user = {
  email: "taro@example.com",
  id: "user_01",
  name: "山田 太郎",
  role: "user",
  twoFactorEnabled: false,
} as const;

const meta = preview.meta({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: noop },
      onNotice: noop,
      onNoticeClear: noop,
      recovery: undefined,
      session: { strong: true, user },
    },
    onRegistered: noop,
  },
  component: PasskeyRegisterForm,
});

export const Default = meta.story();

export const RecoveringAdmin = meta.story({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: noop },
      onNotice: noop,
      onNoticeClear: noop,
      recovery: "1",
      session: { strong: false, user: { ...user, role: "admin" } },
    },
  },
});
