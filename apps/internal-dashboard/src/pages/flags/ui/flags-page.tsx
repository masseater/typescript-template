import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useFlagList } from "#pages/flags/model/flag-list.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { FlagRow } from "./flag-row.tsx";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  const { reload, state, toggle } = useFlagList();

  return (
    <OpsPage title="機能フラグ">
      {state.status === "loading" ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : null}
      {state.status === "failed" ? (
        <StatusMessage variant={STATUS_VARIANT.error}>
          {state.message}
          <button aria-label="再読み込み" className="ml-2 underline" onClick={reload} type="button">
            再読み込み
          </button>
        </StatusMessage>
      ) : null}
      {state.status === "loaded" ? (
        <div className="flex flex-col gap-3">
          {state.flags.map((entry) => (
            <FlagRow key={entry.key} entry={entry} onToggle={toggle} />
          ))}
        </div>
      ) : null}
    </OpsPage>
  );
}

export { FlagsPage };
