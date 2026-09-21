import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { HomeFeed } from "#shared/contracts/index.ts";

import type { FeedItem } from "#shared/contracts/index.ts";

const homeFeedKey = ["home", "feed"] as const;

async function loadHomeFeed(): Promise<readonly FeedItem[]> {
  const { api } = await userClient();
  return apiData(HomeFeed, await api.home.feed.get()).items;
}

const homeFeedOptions = queryOptions({ queryFn: loadHomeFeed, queryKey: homeFeedKey });

export { homeFeedOptions };
