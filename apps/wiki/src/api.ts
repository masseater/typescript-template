import { sessionApi } from "@template/runtime/account";
import { apiBridge, compileApi, createApi, jsonResponse } from "@template/runtime/http";
import type { WikiServices } from "@template/runtime/wiki";
import { Effect } from "effect";
import { searchWiki } from "./lib/search.ts";

const bridge = apiBridge<WikiServices>();

const api = createApi()
  .use(sessionApi(bridge))
  .get(
    "/api/search",
    bridge.raw((request) => {
      const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
      return query
        ? searchWiki(query.slice(0, 200)).pipe(Effect.map((results) => jsonResponse(results)))
        : Effect.succeed(jsonResponse([]));
    }, {}),
  );

export const wikiApi = compileApi(api);
export const dispatchWikiApi = bridge.dispatch;
