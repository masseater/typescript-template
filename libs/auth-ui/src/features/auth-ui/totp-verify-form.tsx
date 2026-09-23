import { type ActionState, Button, FormColumn, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { TotpField } from "./totp-field";

import type { ReactElement, SyntheticEvent } from "react";

const verifySavedTotp = ({
  code,
  onVerified,
  saved,
}: {
  readonly code: { readonly value: string; readonly handleChange: (next: string) => void };
  readonly onVerified: () => void;
  readonly saved: boolean;
}): Effect.Effect<void> =>
  Effect.gen(function* verifyTotpEnrollment() {
    if (!saved) {
      return yield* Effect.die(new Error("バックアップコードを保管してください。"));
    }
    requireSuccess(
      yield* authTask(() =>
        authClient.twoFactor.verifyTotp({ code: code.value, trustDevice: false }),
      ),
    );
    onVerified();
    code.handleChange("");
    globalThis.location.assign("/");
  });

const TotpVerifyForm = ({
  action,
  onVerified,
  saved,
}: {
  readonly action: ActionState;
  readonly saved: boolean;
  readonly onVerified: () => void;
}): ReactElement => {
  const code = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() => Effect.runPromise(verifySavedTotp({ code, onVerified, saved })));
  };
  return (
    <form onSubmit={submit}>
      <FormColumn>
        <TotpField code={code} />
        <Button type="submit" disabled={action.blocked || !saved}>
          {"確認して認証アプリを有効化"}
        </Button>
      </FormColumn>
    </form>
  );
};

export { TotpVerifyForm };
