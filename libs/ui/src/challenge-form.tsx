import { ChallengeCodeField } from "./challenge-code-field";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { FormColumn } from "./shared/ui/form-column";

import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import type { TextInput } from "./use-text-input";

type ChallengeMode = "backup" | "totp";

interface ChallengeFormProps {
  readonly action: ActionState;
  readonly code: TextInput;
  readonly mode: ChallengeMode;
  readonly onAuthenticated: AuthenticatedHandler;
}

async function verifyChallenge(mode: ChallengeMode, code: string): Promise<void> {
  if (mode === "backup") {
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
}

function ChallengeForm({ action, code, mode, onAuthenticated }: ChallengeFormProps): ReactElement {
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    action.run(async () => {
      await verifyChallenge(mode, code.value);
      code.handleChange("");
      if (mode === "backup") {
        globalThis.location.assign("/security?recovery=1");
        return;
      }
      await onAuthenticated();
    });
  }
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <ChallengeCodeField backup={mode === "backup"} code={code} />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {mode === "backup" ? "バックアップコードでログイン" : "確認コードでログイン"}
        </Button>
      </FormColumn>
    </form>
  );
}

export { ChallengeForm };
export type { ChallengeMode };
