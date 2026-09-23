import { Page, resultError, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useFlagList } from "#pages/flags/model/flag-list.ts";
import { FlagRow } from "./flag-row.tsx";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  const { flags, listing, reload, toggle } = useFlagList();
  const failure = resultError(listing);

  return (
    <Page title="機能フラグ">
      {failure !== undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          {failure}
          <button aria-label="再読み込み" className="ml-2 underline" onClick={reload} type="button">
            再読み込み
          </button>
        </StatusMessage>
      ) : null}
      {flags === undefined && failure === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : null}
      {flags?.length === 0 ? (
        <StatusMessage variant={STATUS_VARIANT.empty}>機能フラグはまだありません。</StatusMessage>
      ) : null}
      {flags === undefined ? null : (
        <div className="flex flex-col gap-3">
          {flags.map((entry) => (
            <FlagRow key={entry.key} entry={entry} onToggle={toggle} />
          ))}
        </div>
      )}
    </Page>
  );
}

export { FlagsPage };
