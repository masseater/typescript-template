import { Button, Stack } from "smarthr-ui";
import type { ReactElement, SubmitEventHandler } from "react";
import type { ActionState } from "./action";
import type { ChallengeMode } from "./challenge-form";
import { Field } from "./field";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";

interface CredentialsFormProps {
  readonly action: ActionState;
  readonly email: TextInput;
  readonly password: TextInput;
  readonly onChallenge: (mode: ChallengeMode) => void;
}

function destinationAfterLogin(): string {
  return new URLSearchParams(globalThis.location.search).get("recovery") === "setup"
    ? "/security?recovery=setup"
    : "/";
}

function useCredentialsSubmit({
  action,
  email,
  onChallenge,
  password,
}: CredentialsFormProps): SubmitEventHandler<HTMLFormElement> {
  const { run } = action;
  const { value: emailValue } = email;
  const { setValue: setPassword, value: passwordValue } = password;
  return useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();
      run(async () => {
        const data = requireSuccess(
          await authClient.signIn.email({ email: emailValue, password: passwordValue }),
        );
        setPassword("");
        if ("twoFactorRedirect" in data && data.twoFactorRedirect === true) {
          onChallenge("totp");
          return;
        }
        globalThis.location.assign(destinationAfterLogin());
      });
    },
    [emailValue, onChallenge, passwordValue, run, setPassword],
  );
}

function CredentialsForm(props: CredentialsFormProps): ReactElement {
  const { action, email, password } = props;
  const submit = useCredentialsSubmit(props);
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <Stack>
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email.value}
          onChange={email.handleChange}
        />
        <Field
          label="パスワード"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password.value}
          onChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          ログイン
        </Button>
      </Stack>
    </form>
  );
}

export { CredentialsForm };
