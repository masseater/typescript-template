import { wikiBasePath } from "@repo/config";
import { createApi, jsonResponse, siteRoutes } from "@repo/runtime/http";
import { Effect } from "effect";

import { reporting, runtime } from "./runtime.ts";
import { maximumQueryLength } from "./search-query.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const api = siteRoutes(runtime, reporting);

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

const searchApi = createApi(`${wikiBasePath}/api`).get("/search", ...api.raw(search, {}));

export { searchApi, searchApi as app };
export default searchApi;
