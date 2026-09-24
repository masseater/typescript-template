import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function DraftNotices({
  discardError,
  drafted,
  saveError,
}: Readonly<{
  discardError: string | undefined;
  drafted: boolean;
  saveError: string | undefined;
}>): ReactElement {
  return (
    <>
      {drafted ? (
        <StatusMessage variant={STATUS_VARIANT.info}>
          下書きとして保存されています。公開されたページはまだ変わっていません。
        </StatusMessage>
      ) : null}
      {saveError === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{saveError}</StatusMessage>
      )}
      {discardError === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{discardError}</StatusMessage>
      )}
    </>
  );
}

export { DraftNotices };
