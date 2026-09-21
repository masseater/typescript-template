import { Avatar } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";

import type { ReactElement } from "react";

const illustratedAction =
  "inline-flex w-fit items-center justify-center rounded-md border px-2 py-1.5 text-base leading-none font-bold";

function ProfilePreview(): ReactElement {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <figcaption className="px-5 py-2 text-sm leading-normal font-bold text-foreground">
        {m.profile_preview_caption()}
      </figcaption>
      <div aria-hidden="true" inert>
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
            <span
              className={`${illustratedAction} border-primary bg-primary text-primary-foreground`}
            >
              フォロー
            </span>
            <span className={`${illustratedAction} border-border bg-card text-foreground`}>
              メッセージ
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}

export { ProfilePreview };
