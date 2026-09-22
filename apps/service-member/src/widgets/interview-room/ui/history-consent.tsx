import { Button } from "@repo/ui";

import type { ReactElement } from "react";

function HistoryConsentPanel({
  blocked,
  error,
  onRespond,
}: Readonly<{
  blocked: boolean;
  error: string | undefined;
  onRespond: (accept: boolean) => void;
}>): ReactElement {
  return (
    <section aria-label="インタビュー履歴の同意" className="flex flex-col gap-3">
      <p className="text-base leading-normal text-foreground">
        会話の履歴を残して、次からのレコメンドに使ってもよいですか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label="履歴を残してレコメンドに使う"
          disabled={blocked}
          onClick={() => {
            onRespond(true);
          }}
          type="button"
          variant="primary"
        >
          残す
        </Button>
        <Button
          aria-label="履歴を残さない"
          disabled={blocked}
          onClick={() => {
            onRespond(false);
          }}
          type="button"
          variant="secondary"
        >
          残さない
        </Button>
      </div>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

export { HistoryConsentPanel };
