import { AUTHENTICATION_METHOD, ROLE } from "@repo/config";
import { Button, Field, FormColumn, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { CHALLENGE_MODE } from "./challenge-modes.ts";
import { authClient } from "./client";
import { requireSuccess, type SessionView } from "./protocol";

import type { ReactElement, SyntheticEvent } from "react";
import type { Enrollment, SettingsContext } from "./mfa-types";

const adminLocked = (session: SessionView, recovery: string | undefined): boolean => {
  return (
    session.user.role === ROLE.administrator &&
    (session.user.twoFactorEnabled || (recovery === "1" && !session.strong))
  );
};

const enrollTotp = (password: string): Effect.Effect<Enrollment> =>
  Effect.gen(function* enableTotp() {
    const enabled = requireSuccess(
      yield* authTask(() => authClient.twoFactor.enable({ password })),
    );
    if (enabled.method !== CHALLENGE_MODE.totp) {
      return yield* Effect.die(new Error("サーバーで TOTP 登録が有効になっていません。"));
    }
    return { backupCodes: enabled.backupCodes, totpURI: enabled.totpURI };
  });

const changeTotp = ({
  onEnroll,
  onNoticeClear,
  password,
  recovery,
  session,
}: {
  readonly onEnroll: (enrollment: Enrollment) => void;
  readonly onNoticeClear: () => void;
  readonly password: { readonly value: string; readonly handleChange: (next: string) => void };
  readonly recovery: string | undefined;
  readonly session: SessionView;
}): Effect.Effect<void> =>
  Effect.gen(function* updateTotp() {
    onNoticeClear();
    if (session.user.twoFactorEnabled) {
      requireSuccess(
        yield* authTask(() => authClient.twoFactor.disable({ password: password.value })),
      );
      password.handleChange("");
      globalThis.location.assign(recovery === "1" ? "/login?recovery=setup" : "/login");
      return;
    }
    onEnroll(yield* enrollTotp(password.value));
    password.handleChange("");
  });

const TotpPasswordForm = ({
  context,
  enrolling,
  onEnroll,
}: {
  readonly context: SettingsContext;
  readonly enrolling: boolean;
  readonly onEnroll: (enrollment: Enrollment) => void;
}): ReactElement => {
  const { action, onNoticeClear, recovery, session } = context;
  const password = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() =>
      Effect.runPromise(changeTotp({ onEnroll, onNoticeClear, password, recovery, session })),
    );
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
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
          name={AUTHENTICATION_METHOD.password}
          type={AUTHENTICATION_METHOD.password}
          autoComplete="current-password"
          required
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button
          type="submit"
          disabled={action.blocked || enrolling || adminLocked(session, recovery)}
        >
          {session.user.twoFactorEnabled ? "認証アプリを解除" : "認証アプリの登録を開始"}
        </Button>
      </FormColumn>
    </form>
  );
};

export { TotpPasswordForm };
