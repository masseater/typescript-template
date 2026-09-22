import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { HomeFeed } from "#shared/contracts/index.ts";

import type { FeedItem } from "#shared/contracts/index.ts";

const homeFeedKey = ["home", "feed"] as const;

function loadHomeFeed(): Promise<readonly FeedItem[]> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.home.feed.get().then((response) => apiData(HomeFeed, response).items),
  );
}

const homeFeedOptions = queryOptions({ queryFn: loadHomeFeed, queryKey: homeFeedKey });

export { homeFeedOptions, loadHomeFeed };
