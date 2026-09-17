import { useCallback, useState } from "react";
import { ActionStatus } from "./action-status";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { ChallengeLogin } from "./challenge-login";
import type { ChallengeMode } from "./challenge-form";
import { CredentialsForm } from "./credentials-form";
import { PasskeyLoginButton } from "./passkey-login-button";
import type { ReactElement } from "react";
import { useAction } from "./action";
import { useTextInput } from "./use-text-input";

function goHome(): void {
  globalThis.location.assign("/");
}

function LoginForm({
  onAuthenticated = goHome,
}: Readonly<{ onAuthenticated?: AuthenticatedHandler | undefined }>): ReactElement {
  const email = useTextInput();
  const password = useTextInput();
  const [challenge, setChallenge] = useState<ChallengeMode>();
  const action = useAction();
  const restart = useCallback(() => {
    setChallenge(undefined);
  }, []);
  return (
    <div className="flex w-full flex-col gap-4">
      {challenge === undefined ? (
        <>
          <CredentialsForm
            action={action}
            email={email}
            onAuthenticated={onAuthenticated}
            onChallenge={setChallenge}
            password={password}
          />
          <PasskeyLoginButton action={action} onAuthenticated={onAuthenticated} />
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
    </div>
  );
}

export { LoginForm };
