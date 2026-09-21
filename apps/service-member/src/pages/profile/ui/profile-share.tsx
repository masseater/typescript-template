import {
  Button,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  localState,
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
    Effect.gen(function* copy() {
      yield* Effect.promise(() => navigator.clipboard.writeText(profileUrl(memberId)));
      setFeedback(Option.some("リンクをコピーしました。"));
    }),
  );
}

function shareProfileLink(
  memberId: string,
  setFeedback: (value: Option.Option<string>) => void,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* share() {
      if (typeof navigator.share !== "function") {
        setFeedback(Option.some("この端末では共有機能を使えません。"));
        return;
      }
      yield* Effect.promise(() =>
        navigator.share({ title: "プロフィール", url: profileUrl(memberId) }),
      );
    }),
  );
}

const useQrOpen = localState(false);

function ProfileShare({
  memberId,
  privateProfile,
}: Readonly<{ memberId: string; privateProfile: boolean }>): ReactElement {
  const [feedback, setFeedback] = useOptionalString();
  const [qrOpen, setQrOpen] = useQrOpen();

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
          onClick={() => void copyProfileLink(memberId, setFeedback)}
          type="button"
          variant="secondary"
        >
          リンクをコピー
        </Button>
        <Button onClick={() => setQrOpen((open) => !open)} type="button" variant="secondary">
          QR コード
        </Button>
        <Button
          onClick={() => void shareProfileLink(memberId, setFeedback)}
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
    </section>
  );
}

export { ProfileShare };
