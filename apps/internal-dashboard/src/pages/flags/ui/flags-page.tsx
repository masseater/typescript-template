import { STATUS_VARIANT, StatusMessage, resultError } from "@repo/ui";

import { useFlagList } from "#pages/flags/model/flag-list.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { FlagRow } from "./flag-row.tsx";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  const { flags, listing, reload, toggle } = useFlagList();
  const failure = resultError(listing);

  return (
    <OpsPage title="機能フラグ">
      {failure !== undefined ? (
        <StatusMessage variant={STATUS_VARIANT.error}>
          {failure}
          <button aria-label="再読み込み" className="ml-2 underline" onClick={reload} type="button">
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
            <FlagRow key={entry.key} entry={entry} onToggle={toggle} />
          ))}
        </div>
      )}
    </OpsPage>
  );
}

export { FlagsPage };
