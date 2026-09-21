import { apiData } from "@repo/runtime/client";
import { Button, useAction } from "@repo/ui";

import { userClient } from "#shared/api/index.ts";
import { InterviewView } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function HistoryConsentPanel({
  onResponded,
}: Readonly<{ onResponded: () => Promise<void> }>): ReactElement {
  const action = useAction();

  const respond = (accept: boolean): void => {
    action.run(async () => {
      const { api } = await userClient();
      await apiData(InterviewView, await api.interview["history-consent"].post({ accept }));
      await onResponded();
    });
  };

  return (
    <section aria-label="インタビュー履歴の同意" className="flex flex-col gap-3">
      <p className="text-base leading-normal text-foreground">
        会話の履歴を残して、次からのレコメンドに使ってもよいですか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label="履歴を残してレコメンドに使う"
          disabled={action.blocked}
          onClick={() => {
            respond(true);
          }}
          type="button"
          variant="primary"
        >
          残す
        </Button>
        <Button
          aria-label="履歴を残さない"
          disabled={action.blocked}
          onClick={() => {
            respond(false);
          }}
          type="button"
          variant="secondary"
        >
          残さない
        </Button>
      </div>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </section>
  );
}

export { HistoryConsentPanel };
