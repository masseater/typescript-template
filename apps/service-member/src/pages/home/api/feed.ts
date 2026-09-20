import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HomeFeed } from "#shared/contracts/index.ts";

import type { FeedItem } from "#shared/contracts/index.ts";

async function loadHomeFeed(): Promise<readonly FeedItem[]> {
  const { api } = await userClient();
  return apiData(HomeFeed, await api.home.feed.get()).items;
}

export { loadHomeFeed };
