import { ButtonLink, TextLink } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";
import { MemberPage } from "#widgets/member-page/index.ts";

import type { ReactElement } from "react";

const illustratedAction =
  "inline-flex w-fit items-center justify-center rounded-md border px-2 py-1.5 text-base leading-none font-bold";

const sampleBiography = "週末は本屋めぐり。プロフィールで趣味と近況を書いています。";

function ProfilePreview(): ReactElement {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <figcaption className="px-5 py-2 text-sm leading-normal font-bold text-foreground">
        {m.profile_preview_caption()}
      </figcaption>
      <div aria-hidden="true" inert>
        <MemberPage
          framed={false}
          name="山田 花子"
          nameAs="p"
          place="東京"
          socialLinks={[]}
          biography={
            <p className="text-base leading-relaxed text-muted-foreground">{sampleBiography}</p>
          }
          actions={
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
          }
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-5 py-5">
        <p className="text-base leading-tight font-bold text-foreground">{m.closing_title()}</p>
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink to="/signup" size="large" variant="primary">
            {m.signup_link()}
          </ButtonLink>
          <TextLink to="/login">{m.login_link()}</TextLink>
        </div>
      </div>
    </figure>
  );
}

export { ProfilePreview };
