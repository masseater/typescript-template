import {
  Button,
  FailureStatus,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  localState,
  useAction,
  useOptionalString,
} from "@repo/ui";
import { Effect, Option } from "effect";

import type { ReactElement } from "react";

function profileUrl(memberId: string): string {
  return `${globalThis.location.origin}/users/${memberId}`;
}

function copyProfileLink(
  memberId: string,
  setFeedback: (value: Option.Option<string>) => void,
): Promise<void> {
  return Effect.runPromise(
    Effect.tryPromise({
      catch: () =>
        new Error(
          "リンクをコピーできませんでした。ブラウザがクリップボードへの書き込みを許しているか確かめてください。",
        ),
      try: () => navigator.clipboard.writeText(profileUrl(memberId)),
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          setFeedback(Option.some("リンクをコピーしました。"));
        }),
      ),
    ),
  );
}

function canceledByMember(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function shareProfileLink(memberId: string): Promise<void> {
  if (typeof navigator.share !== "function") {
    return Promise.reject(new Error("この端末では共有機能を使えません。"));
  }
  return Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => navigator.share({ title: "プロフィール", url: profileUrl(memberId) }),
    }).pipe(
      Effect.catchIf(canceledByMember, () => Effect.void),
      Effect.mapError(() => new Error("端末の共有を開けませんでした。")),
    ),
  );
}

const useQrOpen = localState(false);

function ProfileShare({
  memberId,
  privateProfile,
}: Readonly<{ memberId: string; privateProfile: boolean }>): ReactElement {
  const [feedback, setFeedback] = useOptionalString();
  const [qrOpen, setQrOpen] = useQrOpen();
  const sharing = useAction();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Heading as="h2" size="section">
        共有
      </Heading>
      {privateProfile && (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          公開範囲が「自分だけ」のときは、共有しても相手には見えません。
        </StatusMessage>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          action={() => {
            setFeedback(Option.none());
            sharing.run(() => copyProfileLink(memberId, setFeedback));
          }}
          disabled={sharing.blocked}
          type="button"
          variant="secondary"
        >
          リンクをコピー
        </Button>
        <Button onClick={() => setQrOpen((open) => !open)} type="button" variant="secondary">
          QR コード
        </Button>
        <Button
          action={() => {
            setFeedback(Option.none());
            sharing.run(() => shareProfileLink(memberId));
          }}
          disabled={sharing.blocked}
          type="button"
          variant="secondary"
        >
          端末の共有
        </Button>
      </div>
      {qrOpen && (
        <img
          alt="プロフィールの QR コード"
          className="size-44 rounded-md border border-border"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profileUrl(memberId))}`}
        />
      )}
      {Option.isSome(feedback) && <p className="text-sm text-muted-foreground">{feedback.value}</p>}
      <FailureStatus error={sharing.error} />
    </section>
  );
}

export { ProfileShare };
