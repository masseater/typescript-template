import { wikiBasePath } from "@repo/config";
import { queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import type { SortedResult } from "fumadocs-core/search";

class SearchFailed extends Schema.TaggedError<SearchFailed>()("SearchFailed", {
  message: Schema.String,
}) {}

const SearchHit = Schema.Struct({
  content: Schema.String,
  id: Schema.String,
  type: Schema.String,
  url: Schema.String,
});
const WikiSearchResult = Schema.Struct({
  mode: Schema.Literals(["semantic", "keyword_only"]),
  results: Schema.Array(SearchHit),
});

type WikiSearch = Readonly<{
  mode: (typeof WikiSearchResult.Type)["mode"];
  results: SortedResult[];
}>;

const searchApi = `${wikiBasePath}/api/search`;

function searchWiki(query: string): Effect.Effect<WikiSearch, SearchFailed> {
  return Effect.gen(function* wikiSearch() {
    const url = new URL(searchApi, globalThis.location.origin);
    url.searchParams.set("query", query);
    const response = yield* HttpClient.get(url.href).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.orDie,
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* new SearchFailed({ message: yield* response.text.pipe(Effect.orDie) });
    }
    const body = yield* HttpClientResponse.schemaBodyJson(WikiSearchResult)(response).pipe(
      Effect.orDie,
    );
    return { mode: body.mode, results: body.results as SortedResult[] };
  });
}

function wikiSearchOptions(query: string) {
  return queryOptions({
    enabled: query !== "",
    queryFn: () => Effect.runPromise(searchWiki(query)),
    queryKey: ["wiki-search", query] as const,
  });
}

export { wikiSearchOptions };
