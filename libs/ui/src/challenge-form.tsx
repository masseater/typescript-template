import { Button, Stack } from "smarthr-ui";
import type { ReactElement, SubmitEventHandler } from "react";
import type { ActionState } from "./action";
import { Field } from "./field";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";

type ChallengeMode = "backup" | "totp";

interface ChallengeFormProps {
  readonly action: ActionState;
  readonly code: TextInput;
  readonly mode: ChallengeMode;
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

function ChallengeForm({ action, code, mode }: ChallengeFormProps): ReactElement {
  const { run } = action;
  const { setValue: setCode, value: codeValue } = code;
  const submit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();
      run(async () => {
        await verifyChallenge(mode, codeValue);
        setCode("");
        globalThis.location.assign(mode === "backup" ? "/security?recovery=1" : "/");
      });
    },
    [codeValue, mode, run, setCode],
  );
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <Stack>
        {mode === "backup" ? (
          <Field
            label="バックアップコード"
            name="backup-code"
            type="password"
            autoComplete="off"
            required
            value={codeValue}
            onChange={code.handleChange}
          />
        ) : (
          <Field
            label="認証アプリの確認コード"
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={codeValue}
            onChange={code.handleChange}
          />
        )}
        <Button type="submit" variant="primary" disabled={action.blocked}>
          {mode === "backup" ? "バックアップコードでログイン" : "確認コードでログイン"}
        </Button>
      </Stack>
    </form>
  );
}

export { ChallengeForm };
export type { ChallengeMode };
