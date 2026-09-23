import { sessionApi } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi, jsonResponse } from "@repo/runtime/http";
import { Effect } from "effect";

import { flagsApi } from "./flags-api.ts";
import { reporting, runtime } from "./runtime.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const maximumQueryLength = 200;
const api = apiRoutes(runtime, reporting);

function search(request: Request): Effect.Effect<Response, never, WikiServices> {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query === "") {
    return Effect.succeed(jsonResponse({ mode: "semantic", results: [] }));
  }
  return Effect.promise(() => import("./search.ts")).pipe(
    Effect.flatMap(({ searchWiki }) =>
      searchWiki(query.slice(0, maximumQueryLength)).pipe(
        Effect.map((results) => jsonResponse(results)),
      ),
    ),
  );
}

const wikiApi = createApi(apiRoot)
  .use(sessionApi(api))
  .use(flagsApi(api))
  .get("/search", api.raw(search, {}));

export { wikiApi, wikiApi as app };
export default wikiApi;
