import { useQuery } from "@tanstack/react-query";
import { DateTime } from "effect";

import { homeFeedOptions } from "#pages/home/api/feed.ts";
import { getLocale } from "#shared/i18n/index.ts";
import { HomeFeed, homeState, presentFeed } from "./home-feed.tsx";

import type { Locale } from "#shared/i18n/index.ts";
import type { ReactElement } from "react";

const feedTimeOptions = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
} as const;

const feedTimeLabels: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat("en", feedTimeOptions),
  ja: new Intl.DateTimeFormat("ja", feedTimeOptions),
};

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
