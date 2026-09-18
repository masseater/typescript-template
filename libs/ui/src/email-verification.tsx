import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Effect } from "effect";
import type { ReactElement } from "react";
import { Status } from "./shared/ui/status";
import { useAtomValue } from "@effect/atom-react";

async function verifyEmailToken(): Promise<boolean> {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  if (token === null || token === "") {
    return false;
  }
  try {
    const response = await fetch("/api/verify-email", {
      body: JSON.stringify({ token }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function leaveWhenVerified(verified: boolean): Effect.Effect<void> {
  return verified
    ? Effect.sync(() => {
        globalThis.location.replace("/login");
      })
    : Effect.void;
}

const verificationAtom = Atom.make(
  Effect.promise(verifyEmailToken).pipe(Effect.tap(leaveWhenVerified)),
).pipe(Atom.withServerValueInitial);

function EmailVerification(): ReactElement {
  const result = useAtomValue(verificationAtom);
  return AsyncResult.isSuccess(result) && !result.value ? (
    <Status variant="error">
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </Status>
  ) : (
    <Status variant="pending">メールアドレスを確認しています。</Status>
  );
}

export { EmailVerification };
