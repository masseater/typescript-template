import { localState } from "@repo/ui";
import { Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search";

import type { SortedResult } from "fumadocs-core/search";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { ReactElement } from "react";

class SearchFailed extends Schema.TaggedError<SearchFailed>()("SearchFailed", {
  message: Schema.String,
}) {}

type SearchMode = "semantic" | "keyword_only";

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

const searchApi = "/api/search";
const keywordOnlyNotice = "意味検索が使えないため、キーワード検索のみです。";
const useSearchMode = localState(Option.none<SearchMode>());

function searchClient(onMode: (mode: SearchMode | undefined) => void) {
  return {
    deps: [searchApi],
    search(query: string) {
      return Effect.runPromise(
        Effect.gen(function* wikiSearch() {
          const url = new URL(searchApi, globalThis.location.origin);
          url.searchParams.set("query", query);
          const response = yield* HttpClient.get(url.href).pipe(
            Effect.provide(FetchHttpClient.layer),
            Effect.orDie,
          );
          if (response.status < 200 || response.status >= 300) {
            return yield* new SearchFailed({ message: yield* response.text });
          }
          const body = yield* HttpClientResponse.schemaBodyJson(WikiSearchResult)(response).pipe(
            Effect.orDie,
          );
          onMode(body.mode);
          return body.results as SortedResult[];
        }),
      );
    },
  };
}

function WikiSearchDialog({ onOpenChange, open }: SharedProps): ReactElement {
  const [mode, setMode] = useSearchMode();
  const client = searchClient((next) => {
    setMode(next === undefined ? Option.none() : Option.some(next));
  });
  const { search, setSearch, query } = useDocsSearch({ client });
  return (
    <SearchDialog
      isLoading={query.isLoading}
      onOpenChange={onOpenChange}
      onSearchChange={setSearch}
      open={open}
      search={search}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data === "empty" ? null : query.data} />
      </SearchDialogContent>
      <SearchDialogFooter>
        {Option.isSome(mode) && mode.value === "keyword_only" ? (
          <span>{keywordOnlyNotice}</span>
        ) : null}
      </SearchDialogFooter>
    </SearchDialog>
  );
}

export { WikiSearchDialog };
