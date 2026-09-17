import { Button, Field } from "./shared/ui";
import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import type { ChallengeMode } from "./challenge-form";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface CredentialsFormProps {
  readonly action: ActionState;
  readonly email: TextInput;
  readonly password: TextInput;
  readonly onAuthenticated: AuthenticatedHandler;
  readonly onChallenge: (mode: ChallengeMode) => void;
}

async function signIn({
  email,
  onAuthenticated,
  onChallenge,
  password,
}: CredentialsFormProps): Promise<void> {
  const data = requireSuccess(
    await authClient.signIn.email({ email: email.value, password: password.value }),
  );
  password.setValue("");
  if ("twoFactorRedirect" in data && data.twoFactorRedirect === true) {
    onChallenge("totp");
    return;
  }
  if (new URLSearchParams(globalThis.location.search).get("recovery") === "setup") {
    globalThis.location.assign("/security?recovery=setup");
    return;
  }
  await onAuthenticated();
}

function CredentialsForm(props: CredentialsFormProps): ReactElement {
  const { action, email, password } = props;
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    action.run(async () => signIn(props));
  }
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
