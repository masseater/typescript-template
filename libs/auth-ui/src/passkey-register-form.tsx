import { ROLE } from "@repo/config";
import { Button, Field, FormColumn, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSecureContext, requireSuccess } from "./protocol";

import type { ReactElement, SyntheticEvent } from "react";
import type { SettingsContext } from "./mfa-types";

const REGISTERED_NOTICE =
  "パスキーを登録しました。強認証への切り替えにはパスキーでログインし直してください。";

const registerNamedPasskey = ({
  onNotice,
  onNoticeClear,
  onRegistered,
  passkeyName,
}: {
  readonly onNotice: (notice: string) => void;
  readonly onNoticeClear: () => void;
  readonly onRegistered: () => Promise<void>;
  readonly passkeyName: { readonly value: string; readonly handleChange: (next: string) => void };
}): Effect.Effect<void> =>
  Effect.gen(function* registerPasskey() {
    onNoticeClear();
    requireSecureContext();
    requireSuccess(
      yield* authTask(() =>
        authClient.passkey.addPasskey({ createSession: false, name: passkeyName.value }),
      ),
    );
    passkeyName.handleChange("");
    onNotice(REGISTERED_NOTICE);
    yield* authTask(() => onRegistered());
  });

const PasskeyRegisterForm = ({
  context,
  onRegistered,
}: {
  readonly context: SettingsContext;
  readonly onRegistered: () => Promise<void>;
}): ReactElement => {
  const { action, onNotice, onNoticeClear, recovery, session } = context;
  const passkeyName = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() =>
      Effect.runPromise(
        registerNamedPasskey({
          onNotice,
          onNoticeClear,
          onRegistered,
          passkeyName,
        }),
      ),
    );
  };
  const recoveringAdmin =
    session.user.role === ROLE.administrator && !session.strong && recovery === "1";
  return (
    <form onSubmit={submit}>
      <FormColumn>
        <Field
          label="パスキーの名前"
          name="passkey-name"
          maxLength={100}
          required
          value={passkeyName.value}
          onValueChange={passkeyName.handleChange}
        />
        <Button type="submit" disabled={action.blocked || recoveringAdmin}>
          パスキーを登録
        </Button>
      </FormColumn>
    </form>
  );
};

export { PasskeyRegisterForm };
