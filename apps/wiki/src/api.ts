import { apiBridge, compileApi, createApi, jsonResponse } from "@template/runtime/http";
import { Effect } from "effect";
import type { WikiServices } from "@template/runtime/wiki";
import { searchWiki } from "./lib/search.ts";
import { sessionApi } from "@template/runtime/account";

const maximumQueryLength = 200;
const bridge = apiBridge<WikiServices>();

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

const api = createApi().use(sessionApi(bridge)).get("/api/search", bridge.raw(search, {}));

const wikiApi = compileApi(api);
const dispatchWikiApi = bridge.dispatch;

export { dispatchWikiApi, wikiApi };
