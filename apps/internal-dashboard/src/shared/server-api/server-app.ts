import { handleAuthRequest } from "@repo/auth";
import { authUnavailable, databaseUnavailable } from "@repo/runtime/account";
import { apiRoutes, createApi, jsonResponse } from "@repo/runtime/http";
import { Effect } from "effect";

import { dashboardApi } from "./dashboard-api.ts";
import { serveMcp } from "./mcp.ts";
import { reporting, runtime } from "./runtime.ts";
import { searchWiki } from "./search.ts";
import { staffApi } from "./staff-api.ts";
import { wikiRoutes } from "./wiki-api.ts";

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

const wikiApi = wikiRoutes(api)
  .use(staffApi(api))
  .use(dashboardApi(api))
  .get("/search", ...api.raw(search, {}));

const wikiProtocol = createApi("")
  .all("/mcp", ...api.raw(serveMcp, databaseUnavailable))
  .all("/.well-known/oauth-*", ...api.raw(handleAuthRequest, authUnavailable));

export { wikiApi, wikiProtocol };
