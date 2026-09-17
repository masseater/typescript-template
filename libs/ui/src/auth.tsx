import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { Button, Stack } from "smarthr-ui";
import { authClient } from "./client";
import { Field, Status } from "./primitives";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";

export { MFASettings } from "./mfa";

export function LoginForm({
  onAuthenticated = () => window.location.assign("/"),
}: {
  onAuthenticated?: () => Promise<void> | void;
}): ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [backupMode, setBackupMode] = useState(false);
  const action = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.run(async () => {
      if (challenge) {
        if (backupMode) {
          requireSuccess(
            await authClient.twoFactor.verifyBackupCode({
              code: code.trim(),
              trustDevice: false,
              disableSession: false,
            }),
          );
        } else {
          requireSuccess(await authClient.twoFactor.verifyTotp({ code, trustDevice: false }));
        }
        setCode("");
        if (backupMode) window.location.assign("/security?recovery=1");
        else await onAuthenticated();
        return;
      }
      const data = requireSuccess(await authClient.signIn.email({ email, password }));
      setPassword("");
      if ("twoFactorRedirect" in data && data.twoFactorRedirect === true) {
        setBackupMode(false);
        setChallenge(true);
      } else {
        if (new URLSearchParams(window.location.search).get("recovery") === "setup")
          window.location.assign("/security?recovery=setup");
        else await onAuthenticated();
      }
    });
  }
  return (
    <Stack>
      <form onSubmit={submit} aria-busy={action.pending}>
        <Stack>
          {challenge && backupMode ? (
            <Field
              label="バックアップコード"
              name="backup-code"
              type="password"
              autoComplete="off"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          ) : challenge ? (
            <Field
              label="認証アプリの確認コード"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          ) : (
            <>
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
                label="パスワード"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </>
          )}
          <Button type="submit" variant="primary" disabled={action.blocked}>
            {challenge
              ? backupMode
                ? "バックアップコードでログイン"
                : "確認コードでログイン"
              : "ログイン"}
          </Button>
        </Stack>
      </form>
      {!challenge && (
        <Button
          type="button"
          disabled={action.blocked}
          onClick={() =>
            action.run(async () => {
              if (!window.isSecureContext)
                throw new Error("パスキーには HTTPS または localhost が必要です。");
              requireSuccess(await authClient.signIn.passkey());
              await onAuthenticated();
            })
          }
        >
          パスキーでログイン
        </Button>
      )}
      {challenge && (
        <Button
          type="button"
          disabled={action.blocked}
          onClick={() => {
            setBackupMode(!backupMode);
            setCode("");
          }}
        >
          {backupMode ? "認証アプリのコードを使う" : "バックアップコードを使う"}
        </Button>
      )}
      {challenge && (
        <Button
          type="button"
          disabled={action.blocked}
          onClick={() => {
            setChallenge(false);
            setBackupMode(false);
            setCode("");
          }}
        >
          ログイン方法を選び直す
        </Button>
      )}
      {action.pending && <Status>認証を処理しています。</Status>}
      {action.error && <Status error>{action.error}</Status>}
    </Stack>
  );
}

export function SignOutButton() {
  const action = useAction();
  return (
    <>
      <Button
        type="button"
        disabled={action.blocked}
        onClick={() =>
          action.run(async () => {
            requireSuccess(await authClient.signOut());
            window.location.assign("/login");
          })
        }
      >
        ログアウト
      </Button>
      {action.error && <Status error>{action.error}</Status>}
    </>
  );
}
