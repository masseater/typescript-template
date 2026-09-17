import { useCallback, useState } from "react";
import { ActionStatus } from "./action-status";
import { ChallengeLogin } from "./challenge-login";
import type { ChallengeMode } from "./challenge-form";
import { CredentialsForm } from "./credentials-form";
import { PasskeyLoginButton } from "./passkey-login-button";
import type { ReactElement } from "react";
import { Stack } from "smarthr-ui";
import { useAction } from "./action";
import { useTextInput } from "./use-text-input";

function LoginForm(): ReactElement {
  const email = useTextInput();
  const password = useTextInput();
  const [challenge, setChallenge] = useState<ChallengeMode>();
  const action = useAction();
  const restart = useCallback(() => {
    setChallenge(undefined);
  }, []);
  return (
    <Stack>
      {challenge === undefined ? (
        <>
          <CredentialsForm
            action={action}
            email={email}
            onChallenge={setChallenge}
            password={password}
          />
          <PasskeyLoginButton action={action} />
        </>
      ) : (
        <ChallengeLogin
          action={action}
          mode={challenge}
          onModeChange={setChallenge}
          onRestart={restart}
        />
      )}
      <ActionStatus action={action} pendingMessage="認証を処理しています。" />
    </Stack>
  );
}

export { LoginForm };
