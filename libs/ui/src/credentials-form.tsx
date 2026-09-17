import { Button, Field } from "./shared/ui";
import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import type { ChallengeMode } from "./challenge-form";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";

interface CredentialsFormProps {
  readonly action: ActionState;
  readonly email: TextInput;
  readonly password: TextInput;
  readonly onAuthenticated: AuthenticatedHandler;
  readonly onChallenge: (mode: ChallengeMode) => void;
}

function useCredentialsSubmit({
  action,
  email,
  onAuthenticated,
  onChallenge,
  password,
}: CredentialsFormProps): SubmitEventHandler<HTMLFormElement> {
  const { run } = action;
  const { value: emailValue } = email;
  const { setValue: setPassword, value: passwordValue } = password;
  return useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<Pick<SyntheticEvent, "preventDefault">>) => {
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
        if (new URLSearchParams(globalThis.location.search).get("recovery") === "setup") {
          globalThis.location.assign("/security?recovery=setup");
          return;
        }
        await onAuthenticated();
      });
    },
    [emailValue, onAuthenticated, onChallenge, passwordValue, run, setPassword],
  );
}

function CredentialsForm(props: CredentialsFormProps): ReactElement {
  const { action, email, password } = props;
  const submit = useCredentialsSubmit(props);
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <div className="flex w-full max-w-md flex-col gap-4">
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
      </div>
    </form>
  );
}

export { CredentialsForm };
