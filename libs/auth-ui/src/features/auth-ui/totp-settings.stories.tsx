import preview from "../storybook/preview";
import { TotpSettings } from "./totp-settings";

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
  },
  component: TotpSettings,
});

export const NotEnrolled = meta.story();

export const Enrolled = meta.story({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: () => undefined },
      onNotice: () => undefined,
      onNoticeClear: () => undefined,
      recovery: undefined,
      session: { strong: true, user: { ...user, twoFactorEnabled: true } },
    },
  },
});
