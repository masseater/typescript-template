import { ChallengeCodeField } from "./challenge-code-field";
import { CHALLENGE_MODE, type ChallengeMode } from "./challenge-modes.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { FormColumn } from "./shared/ui/form-column";

import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import type { TextInput } from "./use-text-input";

const verifyChallenge = async (challengeMode: ChallengeMode, code: string): Promise<void> => {
  if (challengeMode === CHALLENGE_MODE.backup) {
    requireSuccess(
      await authClient.twoFactor.verifyBackupCode({
        code: code.trim(),
        disableSession: false,
        trustDevice: false,
      }),
    );
    return;
  }
  requireSuccess(await authClient.twoFactor.verifyTotp({ code, trustDevice: false }));
};

const ChallengeForm = ({
  action,
  code,
  mode,
  onAuthenticated,
}: {
  readonly action: ActionState;
  readonly code: TextInput;
  readonly mode: ChallengeMode;
  readonly onAuthenticated: AuthenticatedHandler;
}): ReactElement => {
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(async () => {
      await verifyChallenge(mode, code.value);
      code.handleChange("");
      if (mode === CHALLENGE_MODE.backup) {
        globalThis.location.assign("/security?recovery=1");
        return;
      }
      await onAuthenticated();
    });
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <ChallengeCodeField backup={mode === CHALLENGE_MODE.backup} code={code} />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {mode === CHALLENGE_MODE.backup ? "バックアップコードでログイン" : "確認コードでログイン"}
        </Button>
      </FormColumn>
    </form>
  );
};

export { ChallengeForm };
