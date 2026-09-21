import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect, userEvent } from "storybook/test";

import preview, { playTask } from "../storybook/preview";
import { LoginForm } from "./login-form";

const meta = preview.meta({ args: { onAuthenticated: () => undefined }, component: LoginForm });

export const Default = meta.story();

export const TypesCredentials = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* typeCredentials() {
        yield* playTask(() =>
          userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com"),
        );
        yield* playTask(() =>
          userEvent.type(canvas.getByLabelText("パスワード"), "correct horse battery"),
        );
        yield* playTask(() =>
          expect(canvas.getByRole("button", { name: "ログイン" })).toBeEnabled(),
        );
      }),
    ),
});

export const Rejected = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.post("/api/auth/sign-in/email", () =>
        HttpResponse.json(
          { message: "メールアドレスまたはパスワードが違います。" },
          { status: 401 },
        ),
      ),
    );
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* rejectCredentials() {
        yield* playTask(() =>
          userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com"),
        );
        yield* playTask(() =>
          userEvent.type(canvas.getByLabelText("パスワード"), "wrong password"),
        );
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "ログイン" })),
        );
        const failureAlert = yield* playTask(() => canvas.findByRole("alert"));
        yield* playTask(() =>
          expect(failureAlert).toHaveTextContent("メールアドレスまたはパスワードが違います。"),
        );
      }),
    ),
});
