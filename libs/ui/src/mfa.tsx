import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button, Stack, Heading } from "smarthr-ui";
import { authClient } from "./client";
import { Field, Status } from "./primitives";
import { requireSuccess, errorMessage } from "./protocol";
import type { SessionView } from "./protocol";
import { useAction } from "./action";

type Enrollment = { totpURI: string; backupCodes: string[] };
type PasskeySummary = { id: string; name?: string | null | undefined };

export function MFASettings({ session }: { session: SessionView }): ReactElement {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recovery] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("recovery"),
  );
  const action = useAction();
  const loadPasskeys = useCallback(() => {
    return authClient.passkey
      .listUserPasskeys()
      .then((result) => {
        setPasskeys(requireSuccess(result));
        setListError(null);
        return undefined;
      })
      .catch((cause: unknown) => {
        setPasskeys(null);
        setListError(errorMessage(cause));
      });
  }, []);
  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  return (
    <Stack>
      <Heading>認証アプリとパスキー</Heading>
      {recovery === "1" && (
        <>
          <Status>バックアップコードでログインしました。</Status>
          {session.user.role === "admin" ? (
            <Status>
              復旧コードでは管理者操作はできません。ログアウト後、登録済みのパスキーまたは認証アプリで
              ログインしてください。どちらも使えない場合は、この画面から管理者の認証設定を復旧できません。
            </Status>
          ) : (
            <Status>
              認証アプリを失った場合は、パスワードを入力して古い認証アプリを解除してください。
              再ログイン後に新しい認証アプリを登録できます。使用済みのバックアップコードは再利用できません。
            </Status>
          )}
        </>
      )}
      {recovery === "setup" && <Status>新しい認証アプリを登録してください。</Status>}
      <Status>
        {session.user.twoFactorEnabled ? "認証アプリは設定済みです。" : "認証アプリは未設定です。"}
      </Status>
      <p>
        設定用 URI
        とバックアップコードは秘密情報です。ログやチャットに貼らず、安全な場所に保管してください。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            setMessage(null);
            if (session.user.twoFactorEnabled) {
              requireSuccess(await authClient.twoFactor.disable({ password }));
              setPassword("");
              window.location.assign(recovery === "1" ? "/login?recovery=setup" : "/login");
            } else {
              const data = requireSuccess(await authClient.twoFactor.enable({ password }));
              if (data.method !== "totp")
                throw new Error("サーバーで TOTP 登録が有効になっていません。");
              setEnrollment({ totpURI: data.totpURI, backupCodes: data.backupCodes });
              setSaved(false);
              setPassword("");
            }
          });
        }}
        aria-busy={action.pending}
      >
        <Stack>
          <Field
            label="設定変更を確認するパスワード"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="submit"
            disabled={
              action.pending ||
              enrollment !== null ||
              (session.user.role === "admin" &&
                (session.user.twoFactorEnabled || (recovery === "1" && !session.strong)))
            }
          >
            {session.user.twoFactorEnabled ? "認証アプリを解除" : "認証アプリの登録を開始"}
          </Button>
        </Stack>
      </form>
      {enrollment && (
        <Stack>
          <label htmlFor="totp-uri">認証アプリ登録用 URI</label>
          <textarea id="totp-uri" readOnly value={enrollment.totpURI} autoComplete="off" />
          <Heading>バックアップコード</Heading>
          <ul aria-label="バックアップコード">
            {enrollment.backupCodes.map((backupCode) => (
              <li key={backupCode}>
                <code>{backupCode}</code>
              </li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />
            バックアップコードを保管しました
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => {
                if (!saved) throw new Error("バックアップコードを保管してください。");
                requireSuccess(await authClient.twoFactor.verifyTotp({ code, trustDevice: false }));
                setEnrollment(null);
                setCode("");
                window.location.assign("/");
              });
            }}
          >
            <Stack>
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
              <Button type="submit" disabled={action.pending || !saved}>
                確認して認証アプリを有効化
              </Button>
            </Stack>
          </form>
        </Stack>
      )}
      <Heading>パスキー</Heading>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            setMessage(null);
            if (!window.isSecureContext)
              throw new Error("パスキーには HTTPS または localhost が必要です。");
            requireSuccess(await authClient.passkey.addPasskey({ name, createSession: false }));
            setName("");
            setMessage(
              "パスキーを登録しました。強認証への切り替えにはパスキーでログインし直してください。",
            );
            await loadPasskeys();
          });
        }}
      >
        <Stack>
          <Field
            label="パスキーの名前"
            name="passkey-name"
            maxLength={100}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            disabled={
              action.pending ||
              (session.user.role === "admin" && !session.strong && recovery === "1")
            }
          >
            パスキーを登録
          </Button>
        </Stack>
      </form>
      {listError ? (
        <Status error>{listError}</Status>
      ) : passkeys === null ? (
        <Status>パスキーを取得しています。</Status>
      ) : passkeys.length === 0 ? (
        <Status>登録されたパスキーはありません。</Status>
      ) : (
        <ul>
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              {passkey.name || "名前のないパスキー"}
              <Button
                type="button"
                disabled={action.pending}
                onClick={() =>
                  action.run(async () => {
                    if (
                      !window.confirm("このパスキーを削除しますか？ 削除後は再ログインが必要です。")
                    )
                      return;
                    requireSuccess(await authClient.passkey.deletePasskey({ id: passkey.id }));
                    window.location.assign("/login");
                  })
                }
              >
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        disabled={action.pending}
        onClick={() => {
          void loadPasskeys();
        }}
      >
        パスキー一覧を更新
      </Button>
      {action.pending && <Status>認証設定を更新しています。</Status>}
      {message && <Status>{message}</Status>}
      {action.error && <Status error>{action.error}</Status>}
    </Stack>
  );
}
