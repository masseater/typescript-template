import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { PasskeySettings } from "./passkey-settings";

const listPath = "/api/auth/passkey/list-user-passkeys";

const settingsContext = {
  action: { blocked: false, error: undefined, pending: false, run: () => undefined },
  onNotice: () => undefined,
  onNoticeClear: () => undefined,
  recovery: undefined,
  session: {
    strong: true,
    user: {
      email: "taro@example.com",
      id: "user_01",
      name: "山田 太郎",
      role: "member",
      twoFactorEnabled: false,
    },
  },
} as const;

const meta = preview.meta({ args: { context: settingsContext }, component: PasskeySettings });

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
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showRegisteredPasskeys() {
        const passkeyName = yield* playTask(() => canvas.findByText("MacBook Pro"));
        yield* playTask(() => expect(passkeyName).toBeInTheDocument());
      }),
    ),
});

export const Empty = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(listPath, () => HttpResponse.json([])));
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showEmptyPasskeys() {
        const emptyNotice = yield* playTask(() =>
          canvas.findByText("登録されたパスキーはありません。"),
        );
        yield* playTask(() => expect(emptyNotice).toBeInTheDocument());
      }),
    ),
});

export const Failed = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(listPath, () =>
        HttpResponse.json({ message: "パスキーの取得に失敗しました。" }, { status: 500 }),
      ),
    );
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showPasskeyFailure() {
        const failureAlert = yield* playTask(() => canvas.findByRole("alert"));
        yield* playTask(() => expect(failureAlert).toBeInTheDocument());
      }),
    ),
});
