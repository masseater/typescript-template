import { handleAuthRequest } from "@repo/auth";
import { sessionApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi, jsonResponse } from "@repo/runtime/http";
import { Effect } from "effect";

import { serveMcp } from "./mcp.ts";
import { reporting, runtime } from "./runtime.ts";
import { searchWiki } from "./search.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const maximumQueryLength = 200;
const api = apiRoutes(runtime, reporting);

function search(request: Request): Effect.Effect<Response, never, WikiServices> {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  return query
    ? searchWiki(query.slice(0, maximumQueryLength)).pipe(
        Effect.map((results) => jsonResponse(results)),
      )
    : Effect.succeed(jsonResponse({ mode: "semantic", results: [] }));
}

const wikiApi = createApi(apiRoot).use(sessionApi(api)).get("/search", api.raw(search, {}));

const wikiProtocol = createApi("")
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

export { wikiApi, wikiProtocol };
