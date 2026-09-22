import { useQuery } from "@tanstack/react-query";
import { DateTime } from "effect";

import { homeFeedOptions } from "#pages/home/api/feed.ts";
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

function homeState(
  failure: string | undefined,
  entries: readonly HomeEntry[] | undefined,
  pending: boolean,
): HomeFeedState {
  if (failure !== undefined) {
    return { message: failure, status: "failure" };
  }
  if (pending || entries === undefined) {
    return { status: "pending" };
  }
  if (entries.length === 0) {
    return { status: "empty" };
  }
  return { entries, status: "ready" };
}

function HomePage(): ReactElement {
  const feed = useQuery(homeFeedOptions);
  const updatedAtLabel = feedTimeLabels[getLocale()];
  const entries =
    feed.data === undefined
      ? undefined
      : presentFeed(feed.data, (updatedAt) =>
          updatedAtLabel.format(DateTime.toDate(DateTime.makeUnsafe(updatedAt))),
        );
  return <HomeFeed state={homeState(feed.error?.message, entries, feed.isPending)} />;
}

export { HomePage };
