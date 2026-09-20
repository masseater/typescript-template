import { Heading, NavigationLink, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";

import { homeFeedOptions } from "#pages/home/api/feed.ts";

import type { FeedItem } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function FeedEntry({ item }: Readonly<{ item: FeedItem }>): ReactElement {
  return (
    <li className="rounded-lg border border-border p-3">
      <NavigationLink to="/users/$id" params={{ id: item.actorId }} variant="item">
        {item.actorName}
      </NavigationLink>
      <p className="text-sm leading-normal text-muted-foreground">プロフィールを更新しました</p>
      <p className="text-xs leading-normal text-muted-foreground">
        {updatedAtLabel.format(new Date(item.updatedAt))}
      </p>
    </li>
  );
}

function FeedList({ items }: Readonly<{ items: readonly FeedItem[] }>): ReactElement {
  if (items.length === 0) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>
        フォローしている利用者の動きはまだありません。
      </StatusMessage>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <FeedEntry key={`${item.actorId}-${item.updatedAt}`} item={item} />
      ))}
    </ul>
  );
}

function HomePage(): ReactElement {
  const feed = useQuery(homeFeedOptions);
  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        ホーム
      </Heading>
      {feed.error !== null && <p className="text-sm text-destructive">{feed.error.message}</p>}
      {feed.isPending && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {feed.data !== undefined && <FeedList items={feed.data} />}
    </main>
  );
}

export { HomePage };
