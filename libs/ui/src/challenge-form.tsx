import { BackupCode, TotpCode } from "./auth-input";
import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "./shared/ui/button";
import { ChallengeCodeField } from "./challenge-code-field";
import type { TextFieldApi } from "./form";
import { authClient } from "./client";
import { formColumnClassName } from "./form";
import { requireSuccess } from "./protocol";
import { useForm } from "@tanstack/react-form";

type ChallengeMode = "backup" | "totp";

interface ChallengeFormProps {
  readonly action: ActionState;
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

function ChallengeForm({ action, mode, onAuthenticated }: ChallengeFormProps): ReactElement {
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: ({ value }: Readonly<{ value: Readonly<{ code: string }> }>): void => {
      action.run(async () => {
        await verifyChallenge(mode, value.code);
        form.reset();
        if (mode === "backup") {
          globalThis.location.assign("/security?recovery=1");
          return;
        }
        await onAuthenticated();
      });
    },
    validators: { onSubmit: mode === "backup" ? BackupCode : TotpCode },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={action.pending} className={formColumnClassName}>
      <form.Field name="code">
        {(field: TextFieldApi): ReactElement => (
          <ChallengeCodeField backup={mode === "backup"} field={field} />
        )}
      </form.Field>
      <Button type="submit" variant="primary" disabled={action.blocked}>
        {mode === "backup" ? "バックアップコードでログイン" : "確認コードでログイン"}
      </Button>
    </form>
  );
}

export { ChallengeForm };
export type { ChallengeMode };
