import { useCallback, useEffect, useId, useState } from "react";
import type { ReactElement } from "react";
import { authClient } from "./client";
import { Button, Checkbox, Field, Heading, Label, Stack, Status, Textarea } from "./shared/ui";
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
  const totpUriId = useId();
  const savedId = useId();
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
    <Stack className="max-w-2xl gap-6">
      <Stack className="gap-2">
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
        <Status variant={session.user.twoFactorEnabled ? "success" : "info"}>
          {session.user.twoFactorEnabled
            ? "認証アプリは設定済みです。"
            : "認証アプリは未設定です。"}
        </Status>
        <p className="text-sm text-muted-foreground">
          設定用 URI
          とバックアップコードは秘密情報です。ログやチャットに貼らず、安全な場所に保管してください。
        </p>
      </Stack>
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
        <Stack className="max-w-md gap-4">
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={session.user.email}
            readOnly
            hidden
          />
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
            variant={session.user.twoFactorEnabled ? "danger" : "primary"}
            disabled={
              action.blocked ||
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
        <Stack className="max-w-md gap-4">
          <Stack className="gap-1">
            <Label htmlFor={totpUriId}>認証アプリ登録用 URI</Label>
            <Textarea id={totpUriId} readOnly value={enrollment.totpURI} autoComplete="off" />
          </Stack>
          <Stack className="gap-1">
            <Heading size="block">バックアップコード</Heading>
            <ul aria-label="バックアップコード" className="flex flex-col gap-1">
              {enrollment.backupCodes.map((backupCode) => (
                <li key={backupCode}>
                  <code className="font-mono text-sm">{backupCode}</code>
                </li>
              ))}
            </ul>
          </Stack>
          <div className="flex items-center gap-2">
            <Checkbox id={savedId} checked={saved} onCheckedChange={setSaved} />
            <Label htmlFor={savedId}>バックアップコードを保管しました</Label>
          </div>
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
            <Stack className="gap-4">
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
              <Button type="submit" variant="primary" disabled={action.blocked || !saved}>
                確認して認証アプリを有効化
              </Button>
            </Stack>
          </form>
        </Stack>
      )}
      <Stack className="gap-4">
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
          <Stack className="max-w-md gap-4">
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
              variant="primary"
              disabled={
                action.blocked ||
                (session.user.role === "admin" && !session.strong && recovery === "1")
              }
            >
              パスキーを登録
            </Button>
          </Stack>
        </form>
        {listError ? (
          <Status variant="error">{listError}</Status>
        ) : passkeys === null ? (
          <Status variant="pending">パスキーを取得しています。</Status>
        ) : passkeys.length === 0 ? (
          <Status>登録されたパスキーはありません。</Status>
        ) : (
          <ul className="flex max-w-md flex-col gap-2">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-2">
                {passkey.name || "名前のないパスキー"}
                <Button
                  type="button"
                  variant="danger"
                  size="S"
                  disabled={action.blocked}
                  onClick={() =>
                    action.run(async () => {
                      if (
                        !window.confirm(
                          "このパスキーを削除しますか？ 削除後は再ログインが必要です。",
                        )
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
          disabled={action.blocked}
          onClick={() => {
            void loadPasskeys();
          }}
        >
          パスキー一覧を更新
        </Button>
      </Stack>
      {action.pending && <Status variant="pending">認証設定を更新しています。</Status>}
      {message && <Status variant="success">{message}</Status>}
      {action.error && <Status variant="error">{action.error}</Status>}
    </Stack>
  );
}
