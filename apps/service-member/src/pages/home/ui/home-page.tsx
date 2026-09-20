import { Heading, NavigationLink, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useEffect, useState } from "react";

import { loadHomeFeed } from "#pages/home/api/feed.ts";

import type { FeedItem } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function HomePage(): ReactElement {
  const [items, setItems] = useState<readonly FeedItem[] | undefined>();
  const [labels, setLabels] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void loadHomeFeed()
      .then((feed) => {
        if (!active) {
          return;
        }
        setItems(feed);
        setLabels(
          Object.fromEntries(
            feed.map((item) => [
              `${item.actorId}-${item.updatedAt}`,
              updatedAtLabel.format(new Date(item.updatedAt)),
            ]),
          ),
        );
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "フィードを読めませんでした。");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        ホーム
      </Heading>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {items === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {items !== undefined && items.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          フォローしている利用者の動きはまだありません。
        </StatusMessage>
      )}
      {items !== undefined && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const key = `${item.actorId}-${item.updatedAt}`;
            return (
              <li key={key} className="rounded-lg border border-border p-3">
                <NavigationLink to="/users/$id" params={{ id: item.actorId }} variant="item">
                  {item.actorName}
                </NavigationLink>
                <p className="text-sm leading-normal text-muted-foreground">
                  プロフィールを更新しました
                </p>
                <p className="text-xs leading-normal text-muted-foreground">{labels[key] ?? ""}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export { HomePage };
