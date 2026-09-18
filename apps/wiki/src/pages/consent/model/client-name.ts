import { Effect, Option } from "effect";
import { request, serverQuery, useServerQuery } from "@template/ui";
import type { ServerQueryResult } from "@template/ui";
import { loadClientName } from "#pages/consent/api/consent.ts";

function useClientName(clientId: string): ServerQueryResult<Option.Option<string>> {
  const load = request(async () => loadClientName(clientId)).pipe(
    Effect.map(Option.fromUndefinedOr),
  );
  return useServerQuery(serverQuery(["oauth-client-name", clientId], load));
}

export { useClientName };
