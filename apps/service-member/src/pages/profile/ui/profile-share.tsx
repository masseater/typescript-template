import { Button, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useState } from "react";

import type { ReactElement } from "react";

function profileUrl(memberId: string): string {
  return `${globalThis.location.origin}/users/${memberId}`;
}

function ProfileShare({
  memberId,
  privateProfile,
}: Readonly<{ memberId: string; privateProfile: boolean }>): ReactElement {
  const [message, setMessage] = useState<string | undefined>();
  const [qrOpen, setQrOpen] = useState(false);

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(profileUrl(memberId));
    setMessage("リンクをコピーしました。");
  };

  const shareNative = async (): Promise<void> => {
    if (typeof navigator.share !== "function") {
      setMessage("この端末では共有機能を使えません。");
      return;
    }
    await navigator.share({ title: "プロフィール", url: profileUrl(memberId) });
  };

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
        <Button onClick={() => void copyLink()} type="button" variant="secondary">
          リンクをコピー
        </Button>
        <Button onClick={() => setQrOpen((open) => !open)} type="button" variant="secondary">
          QR コード
        </Button>
        <Button onClick={() => void shareNative()} type="button" variant="secondary">
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
      {message !== undefined && <p className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}

export { ProfileShare };
