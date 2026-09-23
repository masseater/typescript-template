import { useAtomValue } from "@effect/atom-react";
import { StatusMessage, STATUS_VARIANT, requestAtom, resultError } from "@repo/ui";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { authTask } from "./browser-http.ts";
import { verifyEmailToken } from "./verify-email-token.ts";

import type { ReactElement } from "react";

const confirmEmailChange = Effect.gen(function* confirmChangedEmail() {
  const verified = yield* authTask(() => verifyEmailToken());
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  return verified;
});

const confirmationAtom = requestAtom(() => Effect.runPromise(confirmEmailChange));

const EmailChangeConfirmation = ({ retryHref }: Readonly<{ retryHref: string }>): ReactElement => {
  const confirmation = useAtomValue(confirmationAtom);
  const failure = resultError(confirmation);
  if (failure !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>;
  }
  if (!AsyncResult.isSuccess(confirmation)) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>
        {"新しいメールアドレスを確認しています。"}
      </StatusMessage>
    );
  }
  return confirmation.value ? (
    <>
      <StatusMessage variant={STATUS_VARIANT.success}>
        {"メールアドレスを変更しました。次回からは新しいメールアドレスでログインしてください。"}
      </StatusMessage>
      <a href="/login">{"ログイン"}</a>
    </>
  ) : (
    <>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        {
          "確認リンクが無効か、有効期限が切れています。もう一度メールアドレスの変更を申請してください。"
        }
      </StatusMessage>
      <a href={retryHref}>{"メールアドレスの変更へ"}</a>
      <a href="/login">{"ログイン"}</a>
    </>
  );
};

export { EmailChangeConfirmation };
