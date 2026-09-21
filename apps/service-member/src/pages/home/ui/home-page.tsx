import { useAtomValue } from "@effect/atom-react";
import { requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { loadHomeFeed } from "#pages/home/api/feed.ts";
import { getLocale } from "#shared/i18n/index.ts";
import { HomeFeed, presentFeed } from "./home-feed.tsx";

import type { Locale } from "#shared/i18n/index.ts";
import type { ReactElement } from "react";
import type { HomeEntry, HomeFeedState } from "./home-feed.tsx";

const feedTimeOptions = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
} as const;

const feedTimeLabels: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat("en", feedTimeOptions),
  ja: new Intl.DateTimeFormat("ja", feedTimeOptions),
};

const feedAtom = requestAtom(async (): Promise<readonly HomeEntry[]> => {
  const updatedAtLabel = feedTimeLabels[getLocale()];
  return presentFeed(await loadHomeFeed(), (updatedAt) =>
    updatedAtLabel.format(new Date(updatedAt)),
  );
});

function homeState(
  failure: string | undefined,
  entries: readonly HomeEntry[] | undefined,
): HomeFeedState {
  if (failure !== undefined) {
    return { message: failure, status: "failure" };
  }
  if (entries === undefined) {
    return { status: "pending" };
  }
  if (entries.length === 0) {
    return { status: "empty" };
  }
  return { entries, status: "ready" };
}

function HomePage(): ReactElement {
  const feedState = useAtomValue(feedAtom);
  const failure = resultError(feedState);
  const entries = AsyncResult.isSuccess(feedState) ? feedState.value : undefined;
  return <HomeFeed state={homeState(failure, entries)} />;
}

export { HomePage };
