import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { ConsentClient } from "./consent-client.tsx";

import type { ReactElement } from "react";

const consentRoute = getRouteApi("/consent");

function ConsentPage(): ReactElement {
  const { client_id: clientId } = consentRoute.useSearch();
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      ) : (
        <ConsentClient clientId={clientId} />
      )}
    </Page>
  );
}

export { ConsentPage };
