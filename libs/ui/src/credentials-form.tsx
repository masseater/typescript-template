import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { Field } from "./shared/ui/field";
import { FormColumn } from "./shared/ui/form-column";

import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import type { ChallengeMode } from "./challenge-form";
import type { TextInput } from "./use-text-input";

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
}: Omit<CredentialsFormProps, "action">): Promise<void> {
  const data = requireSuccess(
    await authClient.signIn.email({ email: email.value, password: password.value }),
  );
  password.handleChange("");
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
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          ログイン
        </Button>
      </FormColumn>
    </form>
  );
}

export { CredentialsForm };
