import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { clientNameOptions } from "#pages/consent/api/consent.ts";
import { ConsentView } from "./consent-view.tsx";

import type { ReactElement } from "react";

const consentRoute = getRouteApi("/consent");

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const clientName = useQuery(clientNameOptions(clientId));
  return (
    <ConsentView
      client={clientName.data ?? undefined}
      clientId={clientId}
      failure={clientName.error?.message}
    />
  );
}

function ConsentPage(): ReactElement {
  const { client_id: clientId } = consentRoute.useSearch();
  if (clientId === undefined) {
    return <ConsentView client={undefined} clientId={undefined} failure={undefined} />;
  }
  return <ConsentClient clientId={clientId} />;
}

export { ConsentPage };
