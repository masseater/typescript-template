import { type ActionState, Button, ConfirmDialog, localState } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

import type { ReactElement } from "react";
import type { PasskeySummary } from "./mfa-types";

const passkeyLabel = (storedName: string | null | undefined): string => {
  return storedName === undefined || storedName === null || storedName === ""
    ? "名前のないパスキー"
    : storedName;
};

const deleteStoredPasskey = (passkeyId: string): Effect.Effect<void> =>
  authTask(() => authClient.passkey.deletePasskey({ id: passkeyId })).pipe(
    Effect.map(requireSuccess),
    Effect.tap(() =>
      Effect.sync(() => {
        globalThis.location.assign("/login");
      }),
    ),
    Effect.asVoid,
    Effect.orDie,
  );

const usePasskeyConfirming = localState(false);

const PasskeyItem = ({
  action,
  passkey,
}: {
  readonly action: ActionState;
  readonly passkey: PasskeySummary;
}): ReactElement => {
  const [confirming, setConfirming] = usePasskeyConfirming();
  const displayedPasskeyName = passkeyLabel(passkey.name);
  const remove = (): void => {
    setConfirming(false);
    action.run(() => Effect.runPromise(deleteStoredPasskey(passkey.id)));
  };
  return (
    <li>
      {displayedPasskeyName}
      <Button
        type="button"
        disabled={action.blocked}
        onClick={() => {
          setConfirming(true);
        }}
      >
        {"削除"}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${displayedPasskeyName}を削除しますか？`}
        description="削除後は再ログインが必要です。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={remove}
      />
    </li>
  );
};

export { PasskeyItem };
