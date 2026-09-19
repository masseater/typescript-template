import preview from "@repo/ui/storybook/preview";

import { TotpPasswordForm } from "./totp-password-form";

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
    enrolling: false,
    onEnroll: () => undefined,
  },
  component: TotpPasswordForm,
});

export const Enroll = meta.story();

export const Disable = meta.story({
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

export const AdminLocked = meta.story({
  args: {
    context: {
      action: { blocked: false, error: undefined, pending: false, run: () => undefined },
      onNotice: () => undefined,
      onNoticeClear: () => undefined,
      recovery: undefined,
      session: { strong: true, user: { ...user, role: "admin", twoFactorEnabled: true } },
    },
  },
});

export const Enrolling = meta.story({ args: { enrolling: true } });
