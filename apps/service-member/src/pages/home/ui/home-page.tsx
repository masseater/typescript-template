import { formatWarekiDateTime } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";

import { homeFeedOptions } from "#pages/home/api/feed.ts";
import { homeState, presentFeed } from "#pages/home/model/home-feed-state.ts";
import { HomeFeed } from "./home-feed.tsx";

import type { ReactElement } from "react";

function HomePage(): ReactElement {
  const feed = useQuery(homeFeedOptions);
  const entries =
    feed.data === undefined ? undefined : presentFeed(feed.data, formatWarekiDateTime);
  return <HomeFeed state={homeState(feed.error?.message, entries, feed.isPending)} />;
}

export { HomePage };
