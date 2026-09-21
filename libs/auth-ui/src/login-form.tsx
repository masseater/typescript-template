import { ActionStatus, FormColumn, useAction } from "@repo/ui";

import { ChallengeLogin } from "./challenge-login";
import { CredentialsForm } from "./credentials-form";
import { PasskeyLogin } from "./passkey-login";
import { useLoginState } from "./use-login-state";

import type { ReactElement } from "react";
import type { AuthenticatedHandler } from "./authenticated-handler";

const goHome = (): void => {
  globalThis.location.assign("/");
};

const LoginForm = ({
  onAuthenticated = goHome,
}: Readonly<{ onAuthenticated?: AuthenticatedHandler | undefined }>): ReactElement => {
  const login = useLoginState();
  const action = useAction();
  return (
    <FormColumn>
      {login.challenge === undefined ? (
        <>
          <CredentialsForm
            action={action}
            email={login.email}
            onAuthenticated={onAuthenticated}
            onChallenge={login.handleChallenge}
            password={login.password}
          />
          <PasskeyLogin action={action} onAuthenticated={onAuthenticated} />
        </>
      ) : (
        <ChallengeLogin
          action={action}
          mode={login.challenge}
          onAuthenticated={onAuthenticated}
          onModeChange={login.handleChallenge}
          onRestart={login.handleRestart}
        />
      )}
      <ActionStatus action={action} pendingMessage="認証を処理しています。" />
    </FormColumn>
  );
};

export { LoginForm };
