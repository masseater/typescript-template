import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HomeFeed } from "#shared/contracts/index.ts";

import type { FeedItem } from "#shared/contracts/index.ts";

function loadHomeFeed(): Promise<readonly FeedItem[]> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.home.feed.get().then((response) => apiData(HomeFeed, response).items),
  );
}

export { loadHomeFeed };
