import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { Button, Stack } from "smarthr-ui";
import { authClient } from "./client";
import { Field, Status } from "./primitives";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";

export function SignUpForm(): ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.run(async () => {
      requireSuccess(
        await authClient.signUp.email({ name, email, password, callbackURL: "/login" }),
      );
      setPassword("");
      setSent(true);
    });
  }
  return (
    <Stack>
      {sent ? (
        <Status>確認メールを送信しました。メールのリンクで確認後、ログインしてください。</Status>
      ) : (
        <form onSubmit={submit} aria-busy={action.pending}>
          <Stack>
            <Field
              label="ユーザー名"
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Field
              label="メールアドレス"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Field
              label="パスワード（12文字以上）"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" variant="primary" disabled={action.pending}>
              登録して確認メールを送信
            </Button>
          </Stack>
        </form>
      )}
      {action.pending && <Status>登録を処理しています。</Status>}
      {action.error && <Status error>{action.error}</Status>}
    </Stack>
  );
}
