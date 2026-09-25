import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect, screen, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { AccountMenu } from "./account-menu";

import type { ReactElement } from "react";

const SignedInAccountMenu = (): ReactElement => (
  <AccountMenu collapsed={false} email="taro@example.com" name="山田 太郎" />
);

const meta = preview.meta({
  component: SignedInAccountMenu,
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "aria-hidden-focus" }] } } },
});

export const Default = meta.story();

export const SignOutRejected = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.post("/api/auth/sign-out", () =>
        HttpResponse.json({ message: "ログアウトできませんでした。" }, { status: 500 }),
      ),
    );
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* rejectSignOut() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "山田 太郎 のアカウントメニュー" })),
        );
        const signOut = yield* playTask(() =>
          screen.findByRole("menuitem", { name: "ログアウト" }),
        );
        yield* playTask(() => userEvent.click(signOut));
        const toast = yield* playTask(() => screen.findByRole("alert"));
        yield* playTask(() => expect(toast).toHaveTextContent("ログアウト"));
      }),
    ),
});
