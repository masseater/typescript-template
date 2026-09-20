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
import { useMemo, useState } from "react";

import type { SortedResult } from "fumadocs-core/search";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { ReactElement } from "react";

type SearchMode = "semantic" | "keyword_only";

interface WikiSearchResult {
  readonly mode: SearchMode;
  readonly results: SortedResult[];
}

const searchApi = "/api/search";
const keywordOnlyNotice = "意味検索が使えないため、キーワード検索のみです。";

function searchClient(onMode: (mode: SearchMode | undefined) => void) {
  return {
    deps: [searchApi],
    async search(query: string) {
      const url = new URL(searchApi, globalThis.location.origin);
      url.searchParams.set("query", query);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const body = (await response.json()) as WikiSearchResult;
      onMode(body.mode);
      return body.results;
    },
  };
}

function WikiSearchDialog({ onOpenChange, open }: SharedProps): ReactElement {
  const [mode, setMode] = useState<SearchMode | undefined>();
  const client = useMemo(() => searchClient(setMode), []);
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
        {mode === "keyword_only" ? <span>{keywordOnlyNotice}</span> : null}
      </SearchDialogFooter>
    </SearchDialog>
  );
}

export { WikiSearchDialog };
