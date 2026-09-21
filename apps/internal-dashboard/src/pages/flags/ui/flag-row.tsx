import { CheckboxField, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { Effect } from "effect";

import type { FlagEntry } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function FlagRow({
  entry,
  onToggle,
}: Readonly<{
  entry: FlagEntry;
  onToggle: (key: FlagEntry["key"], enabled: boolean) => Promise<string | undefined>;
}>): ReactElement {
  const action = useAction();

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-medium">{entry.key}</p>
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        </div>
        <CheckboxField
          aria-label={`${entry.key} を${entry.enabled ? "オフ" : "オン"}にする`}
          checked={entry.enabled}
          disabled={action.pending}
          label={entry.enabled ? "オン" : "オフ"}
          name={`flag-${entry.key}`}
          onCheckedChange={(checked) => {
            action.run(() =>
              Effect.runPromise(
                Effect.gen(function* toggleRow() {
                  const message = yield* Effect.promise(() =>
                    onToggle(entry.key, checked === true),
                  );
                  if (message !== undefined) {
                    throw new Error(message);
                  }
                }),
              ),
            );
          }}
        />
      </div>
      {action.error === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </div>
  );
}

export { FlagRow };
