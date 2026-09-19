import preview from "@repo/ui/storybook/preview";
import { HttpResponse, http } from "msw";
import { expect } from "storybook/test";

import { MFASettings } from "./mfa";

const listPath = "/api/auth/passkey/list-user-passkeys";

const user = {
  email: "taro@example.com",
  id: "user_01",
  name: "山田 太郎",
  role: "member",
  twoFactorEnabled: false,
} as const;

const meta = preview.meta({
  args: { session: { strong: true, user } },
  beforeEach: ({ msw }) => {
    msw.use(http.get(listPath, () => HttpResponse.json([{ id: "passkey_01", name: "iPhone" }])));
  },
  component: MFASettings,
});

export const NotEnrolled = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("iPhone")).toBeInTheDocument();
  },
});

export const Enrolled = meta.story({
  args: { session: { strong: true, user: { ...user, twoFactorEnabled: true } } },
});

export const Admin = meta.story({
  args: { session: { strong: true, user: { ...user, role: "admin", twoFactorEnabled: true } } },
});
