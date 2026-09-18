import {
  queryOptions,
  experimental_streamedQuery as streamedQuery,
  useQuery,
} from "@tanstack/react-query";

import { commanderClient } from "#shared/api/index.ts";
import { ServerEvent, receiveChat } from "#shared/contract/index.ts";
import type { AppState } from "#shared/contract/index.ts";
import { decodeJson } from "@repo/runtime/client";

type App = typeof AppState.Type;
type Published = typeof ServerEvent.Type;
type Feed = { readonly status: "connecting" } | { readonly app: App; readonly status: "live" };
type View =
  | { readonly status: "connecting" }
  | { readonly status: "invalid" }
  | { readonly app: App; readonly connected: boolean; readonly status: "live" };

const reconnectDelay = 3000;
const feedKey = ["commander", "feed"] as const;
const connecting: Feed = { status: "connecting" };

async function* decoded(incoming: AsyncIterable<unknown>): AsyncGenerator<Published, void> {
  for await (const event of incoming) {
    yield decodeJson(ServerEvent, event);
  }
}

async function events(): Promise<AsyncIterable<Published>> {
  const reply = await commanderClient().events.get();
  return reply.error === null
    ? decoded(reply.data)
    : Promise.reject(new Error("司令塔につながりませんでした。"));
}

function received(app: App, event: Exclude<Published, { readonly event: "state" }>): App {
  if (event.event === "chat") {
    return { ...app, chat: receiveChat(app.chat, event.data) };
  }
  return event.event === "ledger" ? { ...app, ledger: event.data } : { ...app, tasks: event.data };
}

function reduced(feed: Feed, event: Published): Feed {
  if (event.event === "state") {
    return { app: event.data, status: "live" };
  }
  return feed.status === "live" ? { app: received(feed.app, event), status: "live" } : feed;
}

const feedOptions = queryOptions({
  queryFn: streamedQuery({
    initialValue: connecting,
    reducer: reduced,
    refetchMode: "append",
    streamFn: events,
  }),
  queryKey: feedKey,
  refetchInterval: reconnectDelay,
  retry: true,
  retryDelay: reconnectDelay,
  staleTime: Infinity,
});

function useView(): View {
  const feed = useQuery(feedOptions);
  if (feed.data === undefined || feed.data.status === "connecting") {
    return feed.isError ? { status: "invalid" } : { status: "connecting" };
  }
  return { app: feed.data.app, connected: feed.fetchStatus === "fetching", status: "live" };
}

export { feedKey, useView };
