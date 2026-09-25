import { FailureStatus, localState } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
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
import { useDeferredValue } from "react";

import { wikiSearchOptions } from "#shared/api/index.ts";

import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { ReactElement } from "react";

const keywordOnlyNotice = "意味検索が使えないため、キーワード検索のみです。";
const searchFailedNotice = "検索できませんでした。時間をおいてもう一度お試しください。";
const useSearchText = localState("");

function WikiSearchDialog({ onOpenChange, open }: SharedProps): ReactElement {
  const [search, setSearch] = useSearchText();
  const deferred = useDeferredValue(search);
  const result = useQuery(wikiSearchOptions(deferred));
  return (
    <SearchDialog
      isLoading={result.isLoading || search !== deferred}
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
        <SearchDialogList items={deferred === "" ? null : (result.data?.results ?? null)} />
      </SearchDialogContent>
      <SearchDialogFooter>
        <FailureStatus error={result.isError ? searchFailedNotice : undefined} />
        {result.data?.mode === "keyword_only" ? <span>{keywordOnlyNotice}</span> : null}
      </SearchDialogFooter>
    </SearchDialog>
  );
}

export { WikiSearchDialog };
