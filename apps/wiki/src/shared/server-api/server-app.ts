import { Effect } from "effect";

import { handleAuthRequest } from "@template/auth";
import { sessionApi, unavailable } from "@template/runtime/account";
import { apiRoot, apiRoutes, compileApi, createApi, jsonResponse } from "@template/runtime/http";
import type { WikiServices } from "@template/runtime/wiki";

import { serveMcp } from "./mcp.ts";
import { runtime } from "./runtime.ts";
import { searchWiki } from "./search.ts";

const maximumQueryLength = 200;
const api = apiRoutes(runtime);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function search(request: Request): Effect.Effect<Response, never, WikiServices> {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  return query
    ? searchWiki(query.slice(0, maximumQueryLength)).pipe(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        Effect.map((results) => jsonResponse(results)),
      )
    : Effect.succeed(jsonResponse([]));
}

const app = createApi(apiRoot).use(sessionApi(api)).get("/search", api.raw(search, {}));

const protocol = createApi("")
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

const wikiApi = compileApi(app);
const wikiProtocol = compileApi(protocol);

export { wikiApi, wikiProtocol };
