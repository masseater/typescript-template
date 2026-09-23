import preview from "../../../storybook/preview";
import { PasskeyRegisterForm } from "./passkey-register-form";

const user = {
  email: "taro@example.com",
  id: "user_01",
  name: "山田 太郎",
  role: "member",
  twoFactorEnabled: false,
} as const;

const meta = preview.meta({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: () => undefined },
      onNotice: () => undefined,
      onNoticeClear: () => undefined,
      recovery: undefined,
      session: { strong: true, user },
    },
    onRegistered: (): Promise<void> => Promise.resolve(),
  },
  component: PasskeyRegisterForm,
});

export const Default = meta.story();

export const RecoveringAdmin = meta.story({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: () => undefined },
      onNotice: () => undefined,
      onNoticeClear: () => undefined,
      recovery: "1",
      session: { strong: false, user: { ...user, role: "admin" } },
    },
  },
});
