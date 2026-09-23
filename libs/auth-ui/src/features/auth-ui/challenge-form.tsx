import { type ActionState, type TextInput, Button, FormColumn } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { ChallengeCodeField } from "./challenge-code-field";
import { CHALLENGE_MODE, type ChallengeMode } from "./challenge-modes.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

import type { ReactElement, SyntheticEvent } from "react";
import type { AuthenticatedHandler } from "./authenticated-handler";

const verifyChallenge = (challengeMode: ChallengeMode, code: string): Effect.Effect<void> =>
  challengeMode === CHALLENGE_MODE.backup
    ? authTask(() =>
        authClient.twoFactor.verifyBackupCode({
          code: code.trim(),
          disableSession: false,
          trustDevice: false,
        }),
      ).pipe(Effect.map(requireSuccess), Effect.asVoid)
    : authTask(() => authClient.twoFactor.verifyTotp({ code, trustDevice: false })).pipe(
        Effect.map(requireSuccess),
        Effect.asVoid,
      );

const completeChallenge = ({
  code,
  mode,
  onAuthenticated,
}: {
  readonly code: TextInput;
  readonly mode: ChallengeMode;
  readonly onAuthenticated: AuthenticatedHandler;
}): Effect.Effect<void> =>
  Effect.gen(function* finishChallenge() {
    yield* verifyChallenge(mode, code.value);
    code.handleChange("");
    if (mode === CHALLENGE_MODE.backup) {
      globalThis.location.assign("/security?recovery=1");
      return;
    }
    yield* authTask(() => Promise.resolve(onAuthenticated()));
  });

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
    action.run(() => Effect.runPromise(completeChallenge({ code, mode, onAuthenticated })));
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
