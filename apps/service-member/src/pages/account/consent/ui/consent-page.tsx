import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

function ConsentPage({ client }: Readonly<{ client: string | undefined }>): ReactElement {
  return (
    <Page title={`${serviceName} との連携`}>
      {client === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      ) : (
        <ConsentActions client={client} />
      )}
    </Page>
  );
}

export { ConsentPage };
