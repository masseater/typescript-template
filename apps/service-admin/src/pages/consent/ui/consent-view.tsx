import { FailureStatus, Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

function ConsentView({
  client,
  clientId,
  failure,
}: Readonly<{
  client: string | undefined;
  clientId: string | undefined;
  failure: string | undefined;
}>): ReactElement {
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      )}
      {client !== undefined && <ConsentActions client={client} />}
      {clientId !== undefined && client === undefined && failure === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      <FailureStatus error={failure} />
    </Page>
  );
}

export { ConsentView };
