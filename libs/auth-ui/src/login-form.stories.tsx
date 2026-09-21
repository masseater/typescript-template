import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect, userEvent } from "storybook/test";

import preview from "../storybook/preview";
import { LoginForm } from "./login-form";

const meta = preview.meta({ args: { onAuthenticated: () => undefined }, component: LoginForm });

export const Default = meta.story();

export const TypesCredentials = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* typeCredentials() {
        yield* Effect.promise(() =>
          userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com"),
        );
        yield* Effect.promise(() =>
          userEvent.type(canvas.getByLabelText("パスワード"), "correct horse battery"),
        );
        yield* Effect.promise(() =>
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
        yield* Effect.promise(() =>
          userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com"),
        );
        yield* Effect.promise(() =>
          userEvent.type(canvas.getByLabelText("パスワード"), "wrong password"),
        );
        yield* Effect.promise(() =>
          userEvent.click(canvas.getByRole("button", { name: "ログイン" })),
        );
        const failureAlert = yield* Effect.promise(() => canvas.findByRole("alert"));
        yield* Effect.promise(() =>
          expect(failureAlert).toHaveTextContent("メールアドレスまたはパスワードが違います。"),
        );
      }),
    ),
});
