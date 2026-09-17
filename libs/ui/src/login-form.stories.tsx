import { HttpResponse, http } from "msw";
import { expect, fn, userEvent } from "storybook/test";
import { LoginForm } from "./login-form";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { onAuthenticated: fn() }, component: LoginForm });

export const Default = meta.story();

export const TypesCredentials = meta.story({
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com");
    await userEvent.type(canvas.getByLabelText("パスワード"), "correct horse battery");
    await expect(canvas.getByRole("button", { name: "ログイン" })).toBeEnabled();
  },
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
  parameters: { a11y: { test: "todo" } },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText("メールアドレス"), "taro@example.com");
    await userEvent.type(canvas.getByLabelText("パスワード"), "wrong password");
    await userEvent.click(canvas.getByRole("button", { name: "ログイン" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが違います。",
    );
  },
});
