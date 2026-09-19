import { useState, type ReactElement } from "react";

import { useAction } from "./action";
import { ActionStatus } from "./action-status";
import { ChallengeLogin } from "./challenge-login";
import { CredentialsForm } from "./credentials-form";
import { PasskeyLogin } from "./passkey-login";
import { FormColumn } from "./shared/ui/form-column";
import { useTextInput } from "./use-text-input";

import type { AuthenticatedHandler } from "./authenticated-handler";
import type { ChallengeMode } from "./challenge-modes.ts";

const goHome = (): void => {
  globalThis.location.assign("/");
};

const LoginForm = ({
  onAuthenticated = goHome,
}: Readonly<{ onAuthenticated?: AuthenticatedHandler | undefined }>): ReactElement => {
  const email = useTextInput();
  const password = useTextInput();
  const [challenge, setChallenge] = useState<ChallengeMode>();
  const action = useAction();
  const restart = (): void => {
    setChallenge(undefined);
    email.handleChange("");
    password.handleChange("");
  };
  return (
    <FormColumn>
      {challenge === undefined ? (
        <>
          <CredentialsForm
            action={action}
            email={email}
            onAuthenticated={onAuthenticated}
            onChallenge={setChallenge}
            password={password}
          />
          <PasskeyLogin action={action} onAuthenticated={onAuthenticated} />
        </>
      ) : (
        <ChallengeLogin
          action={action}
          mode={challenge}
          onAuthenticated={onAuthenticated}
          onModeChange={setChallenge}
          onRestart={restart}
        />
      )}
      <ActionStatus action={action} pendingMessage="認証を処理しています。" />
    </FormColumn>
  );
};

export { LoginForm };
