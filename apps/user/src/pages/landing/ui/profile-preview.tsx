import { Avatar, Button } from "@repo/ui";

import type { ReactElement } from "react";

function ProfilePreview(): ReactElement {
  return (
    <aside
      aria-hidden="true"
      inert
      className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="h-24 bg-secondary" />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="-mt-10">
          <Avatar name="山田花子" size="large" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xl leading-tight font-bold">山田 花子</p>
          <p className="text-sm leading-normal text-muted-foreground">東京</p>
        </div>
        <p className="text-base leading-relaxed text-muted-foreground">
          週末は本屋めぐり。プロフィールで趣味と近況を書いています。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary">
            フォロー
          </Button>
          <Button type="button" variant="secondary">
            メッセージ
          </Button>
        </div>
      </div>
    </aside>
  );
}

export { ProfilePreview };
