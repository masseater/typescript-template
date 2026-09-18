import { ActionStatus } from "./action-status";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { ChallengeLogin } from "./challenge-login";
import type { ChallengeMode } from "./challenge-form";
import { CredentialsForm } from "./credentials-form";
import { FormColumn } from "./shared/ui/form-column";
import { PasskeyLogin } from "./passkey-login";
import type { ReactElement } from "react";
import { useAction } from "./action";
import { useState } from "react";

function goHome(): void {
  globalThis.location.assign("/");
}

function LoginForm({
  onAuthenticated = goHome,
}: Readonly<{ onAuthenticated?: AuthenticatedHandler | undefined }>): ReactElement {
  const [challenge, setChallenge] = useState<ChallengeMode>();
  const action = useAction();
  function restart(): void {
    setChallenge(undefined);
  }
  return (
    <FormColumn>
      {challenge === undefined ? (
        <>
          <CredentialsForm
            action={action}
            onAuthenticated={onAuthenticated}
            onChallenge={setChallenge}
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
}

export { LoginForm };
