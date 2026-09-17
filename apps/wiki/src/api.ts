import { apiRoutes, createApi, jsonResponse } from "@template/runtime/http";
import { Effect } from "effect";
import type { WikiServices } from "@template/runtime/wiki";
import { runtime } from "./runtime.ts";
import { searchWiki } from "./lib/search.ts";
import { sessionApi } from "@template/runtime/account";

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

const wikiApi = createApi().use(sessionApi(api)).get("/api/search", api.raw(search, {}));

export { wikiApi };
