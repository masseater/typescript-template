import { apiRoot, apiRoutes, createApi, jsonResponse } from "@repo/runtime/http";
import { sessionApi, unavailable } from "@repo/runtime/account";
import { Effect } from "effect";
import type { WikiServices } from "@repo/runtime/wiki";
import { handleAuthRequest } from "@repo/auth";
import { runtime } from "./runtime.ts";
import { searchWiki } from "./search.ts";
import { serveMcp } from "./mcp.ts";

const maximumQueryLength = 200;
const api = apiRoutes(runtime);

function search(request: Request): Effect.Effect<Response, never, WikiServices> {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  return query
    ? searchWiki(query.slice(0, maximumQueryLength)).pipe(
        Effect.map((results) => jsonResponse(results)),
      )
    : Effect.succeed(jsonResponse([]));
}

const wikiApi = createApi(apiRoot).use(sessionApi(api)).get("/search", api.raw(search, {}));

const wikiProtocol = createApi("")
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

export { wikiApi, wikiProtocol };
