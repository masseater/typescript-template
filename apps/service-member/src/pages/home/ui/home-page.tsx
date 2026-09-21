import { useAtomValue } from "@effect/atom-react";
import {
  Heading,
  NavigationLink,
  STATUS_VARIANT,
  StatusMessage,
  requestAtom,
  resultError,
} from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { loadHomeFeed } from "#pages/home/api/feed.ts";

import type { FeedItem } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type HomeFeed = {
  readonly items: readonly FeedItem[];
  readonly labels: Readonly<Record<string, string>>;
};

const feedAtom = requestAtom(async (): Promise<HomeFeed> => {
  const feed = await loadHomeFeed();
  return {
    items: feed,
    labels: Object.fromEntries(
      feed.map((item) => [
        `${item.actorId}-${item.updatedAt}`,
        updatedAtLabel.format(new Date(item.updatedAt)),
      ]),
    ),
  };
});

function HomePage(): ReactElement {
  const feedState = useAtomValue(feedAtom);
  const failure = resultError(feedState);
  const feed = AsyncResult.isSuccess(feedState) ? feedState.value : undefined;
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        ホーム
      </Heading>
      {failure !== undefined && <p className="text-sm text-destructive">{failure}</p>}
      {feed === undefined && failure === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {feed !== undefined && feed.items.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.empty}>
          フォローしている利用者の動きはまだありません。
        </StatusMessage>
      )}
      {feed !== undefined && feed.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {feed.items.map((item) => {
            const key = `${item.actorId}-${item.updatedAt}`;
            return (
              <li key={key} className="rounded-lg border border-border p-3">
                <NavigationLink to="/users/$id" params={{ id: item.actorId }} variant="item">
                  {item.actorName}
                </NavigationLink>
                <p className="text-sm leading-normal text-muted-foreground">
                  プロフィールを更新しました
                </p>
                <p className="text-xs leading-normal text-muted-foreground">
                  {feed.labels[key] ?? ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export { HomePage };
