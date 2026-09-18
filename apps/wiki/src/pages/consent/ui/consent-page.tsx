import { Page, Status } from "@template/ui";
import { ConsentClient } from "./consent-client.tsx";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { serviceName } from "#shared/config/index.ts";

const consentRoute = getRouteApi("/consent");

function ConsentPage(): ReactElement {
  const { client_id: clientId } = consentRoute.useSearch();
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined ? (
        <Status variant="error">連携を求めているクライアントが分かりません。</Status>
      ) : (
        <ConsentClient clientId={clientId} />
      )}
    </Page>
  );
}

export { ConsentPage };
