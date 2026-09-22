import { AUTHENTICATION_METHOD } from "@repo/config";
import { type ActionState, type TextInput, Button, Field, FormColumn } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { CHALLENGE_MODE, type ChallengeMode } from "./challenge-modes.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

import type { ReactElement, SyntheticEvent } from "react";
import type { AuthenticatedHandler } from "./authenticated-handler";

type CredentialsFormProps = {
  readonly action: ActionState;
  readonly email: TextInput;
  readonly password: TextInput;
  readonly onAuthenticated: AuthenticatedHandler;
  readonly onChallenge: (mode: ChallengeMode) => void;
};

const signIn = ({
  email,
  onAuthenticated,
  onChallenge,
  password,
}: Omit<CredentialsFormProps, "action">): Effect.Effect<void> =>
  Effect.gen(function* signInWithPassword() {
    const signedIn = requireSuccess(
      yield* authTask(() =>
        authClient.signIn.email({ email: email.value, password: password.value }),
      ),
    );
    password.handleChange("");
    if ("twoFactorRedirect" in signedIn && signedIn.twoFactorRedirect === true) {
      onChallenge(CHALLENGE_MODE.totp);
      return;
    }
    if (
      new URLSearchParams(globalThis.location.search).get(AUTHENTICATION_METHOD.recovery) ===
      "setup"
    ) {
      globalThis.location.assign("/security?recovery=setup");
      return;
    }
    yield* authTask(() => Promise.resolve(onAuthenticated()));
  });

const CredentialsForm = (props: CredentialsFormProps): ReactElement => {
  const { action, email, password } = props;
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() => Effect.runPromise(signIn(props)));
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email.value}
          onValueChange={email.handleChange}
        />
        <Field
          label="パスワード"
          name={AUTHENTICATION_METHOD.password}
          type="password"
          autoComplete="current-password"
          required
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {"ログイン"}
        </Button>
      </FormColumn>
    </form>
  );
};

export { CredentialsForm };
