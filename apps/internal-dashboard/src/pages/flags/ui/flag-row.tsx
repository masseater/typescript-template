import { CheckboxField, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useState } from "react";

import type { FlagEntry } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function FlagRow({
  entry,
  onToggle,
}: Readonly<{
  entry: FlagEntry;
  onToggle: (key: FlagEntry["key"], enabled: boolean) => Promise<string | undefined>;
}>): ReactElement {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

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
          disabled={pending}
          label={entry.enabled ? "オン" : "オフ"}
          name={`flag-${entry.key}`}
          onCheckedChange={(checked) => {
            setPending(true);
            setError(undefined);
            void onToggle(entry.key, checked === true).then((message) => {
              setPending(false);
              setError(message);
            });
          }}
        />
      </div>
      {error === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.error}>{error}</StatusMessage>
      )}
    </div>
  );
}

export { FlagRow };
