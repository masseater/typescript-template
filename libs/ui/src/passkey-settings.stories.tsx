import { HttpResponse, http } from "msw";
import { PasskeySettings } from "./passkey-settings";
import { expect } from "storybook/test";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const listPath = "/api/auth/passkey/list-user-passkeys";

const context = {
  action: { blocked: false, error: undefined, pending: false, run: noop },
  onNotice: noop,
  onNoticeClear: noop,
  recovery: undefined,
  session: {
    strong: true,
    user: {
      email: "taro@example.com",
      id: "user_01",
      name: "山田 太郎",
      role: "user",
      twoFactorEnabled: false,
    },
  },
} as const;

const meta = preview.meta({ args: { context }, component: PasskeySettings });

export const Registered = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(listPath, () =>
        HttpResponse.json([
          { id: "passkey_01", name: "MacBook Pro" },
          { id: "passkey_02", name: "iPhone" },
        ]),
      ),
    );
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("MacBook Pro")).toBeInTheDocument();
  },
});

export const Empty = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(listPath, () => HttpResponse.json([])));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("登録されたパスキーはありません。")).toBeInTheDocument();
  },
});

export const Failed = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(listPath, () =>
        HttpResponse.json({ message: "パスキーの取得に失敗しました。" }, { status: 500 }),
      ),
    );
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
});
