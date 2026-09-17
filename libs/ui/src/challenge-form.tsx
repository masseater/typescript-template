import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "./shared/ui";
import { ChallengeCodeField } from "./challenge-code-field";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";

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
  const { run } = action;
  const { setValue: setCode, value: codeValue } = code;
  const submit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<Pick<SyntheticEvent, "preventDefault">>) => {
      event.preventDefault();
      run(async () => {
        await verifyChallenge(mode, codeValue);
        setCode("");
        if (mode === "backup") {
          globalThis.location.assign("/security?recovery=1");
          return;
        }
        await onAuthenticated();
      });
    },
    [codeValue, mode, onAuthenticated, run, setCode],
  );
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <ChallengeCodeField backup={mode === "backup"} code={code} />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {mode === "backup" ? "バックアップコードでログイン" : "確認コードでログイン"}
        </Button>
      </div>
    </form>
  );
}

export { ChallengeForm };
export type { ChallengeMode };
