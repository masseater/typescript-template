import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

function ConsentView({
  client,
  clientId,
  error,
  onError,
}: Readonly<{
  client: string | undefined;
  clientId: string | undefined;
  error: string;
  onError: (message: string) => void;
}>): ReactElement {
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      )}
      {client !== undefined && <ConsentActions client={client} onError={onError} />}
      {clientId !== undefined && client === undefined && error === "" && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {error !== "" && <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>}
    </Page>
  );
}

export { ConsentView };
