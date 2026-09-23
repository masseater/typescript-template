import {
  maximumNameLength,
  maximumPasswordLength,
  minimumPasswordLength,
} from "@repo/runtime/contracts";
import { ActionStatus, Button, Field, FormColumn, useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";
import { HttpBody, HttpClient } from "effect/unstable/http";
import { type ReactElement, type SyntheticEvent } from "react";

import { browserHttp } from "./browser-http.ts";
import { readFailureMessage } from "./invite-preview.ts";

const postAcceptance = (
  endpoint: string,
  acceptance: Readonly<{ name: string; password: string; token: string }>,
): Effect.Effect<void> =>
  Effect.gen(function* submitAcceptance() {
    const requestPayload = yield* HttpBody.json(acceptance).pipe(Effect.orDie);
    const served = yield* HttpClient.post(endpoint, { body: requestPayload }).pipe(
      Effect.provide(browserHttp),
      Effect.orDie,
    );
    if (served.status >= 200 && served.status < 300) {
      return;
    }
    const failureDetail = yield* readFailureMessage(
      served,
      "招待を受け付けられませんでした。",
    ).pipe(Effect.orDie);
    return yield* Effect.die(new Error(failureDetail));
  });

const InviteForm = ({
  email,
  endpoint,
  onAccepted,
  token,
}: Readonly<{
  email: string;
  endpoint: string;
  onAccepted: () => void;
  token: string;
}>): ReactElement => {
  const action = useAction();
  const displayName = useTextInput();
  const password = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() =>
      Effect.runPromise(
        postAcceptance(endpoint, {
          name: displayName.value,
          password: password.value,
          token,
        }).pipe(Effect.tap(() => Effect.sync(onAccepted))),
      ),
    );
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending} aria-label="招待を受ける">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={email} />
        <Field
          label="名前"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={maximumNameLength}
          value={displayName.value}
          onValueChange={displayName.handleChange}
        />
        <Field
          label="パスワード"
          name="account-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minimumPasswordLength}
          maxLength={maximumPasswordLength}
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {"アカウントを作成する"}
        </Button>
        <ActionStatus action={action} pendingMessage="アカウントを作成しています。" />
      </FormColumn>
    </form>
  );
};

export { InviteForm };
