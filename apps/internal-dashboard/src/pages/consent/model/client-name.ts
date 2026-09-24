import { useQuery } from "@tanstack/react-query";

import { clientNameOptions } from "#pages/consent/api/consent.ts";

function useClientName(clientId: string) {
  return useQuery(clientNameOptions(clientId));
}

export { useClientName };
