import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { FlagRow } from "./flag-row.tsx";

import type { FlagEntry } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function FlagsView({
  failure,
  flags,
  onReload,
  onToggle,
}: Readonly<{
  failure: string | undefined;
  flags: readonly FlagEntry[] | undefined;
  onReload: () => void;
  onToggle: (key: FlagEntry["key"], enabled: boolean) => Promise<string | undefined>;
}>): ReactElement {
  return (
    <Page layout="full" title="機能フラグ">
      {failure !== undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          {failure}
          <button
            aria-label="再読み込み"
            className="ml-2 underline"
            onClick={onReload}
            type="button"
          >
            再読み込み
          </button>
        </StatusMessage>
      ) : null}
      {flags === undefined && failure === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : null}
      {flags === undefined ? null : (
        <div className="flex flex-col gap-3">
          {flags.map((entry) => (
            <FlagRow key={entry.key} entry={entry} onToggle={onToggle} />
          ))}
        </div>
      )}
    </Page>
  );
}

export { FlagsView };
