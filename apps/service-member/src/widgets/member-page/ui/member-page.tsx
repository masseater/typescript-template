import { Avatar, type UiNode } from "@repo/ui";

import { SocialLinks } from "#shared/social-link";

import type { ReactElement } from "react";

function MemberPage({
  actions,
  biography,
  framed = true,
  joinedLabel,
  name,
  nameAs,
  place,
  socialLinks,
}: Readonly<{
  actions?: UiNode;
  biography: UiNode;
  framed?: boolean;
  joinedLabel?: string;
  name: string;
  nameAs: "h1" | "p";
  place?: string;
  socialLinks: readonly string[];
}>): ReactElement {
  const NameTag = nameAs;
  return (
    <article
      data-slot="member-page"
      className={
        framed
          ? "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
          : "bg-card text-card-foreground"
      }
    >
      <div aria-hidden="true" className="h-24 bg-secondary" />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="-mt-10 w-fit rounded-full ring-4 ring-card">
          <Avatar name={name} size="large" />
        </div>
        <div className="flex flex-col gap-1">
          <NameTag className="text-xl leading-tight font-bold text-foreground">{name}</NameTag>
          {place !== undefined && (
            <p className="text-sm leading-normal text-muted-foreground">{place}</p>
          )}
        </div>
        {biography}
        <SocialLinks urls={socialLinks} />
        {joinedLabel !== undefined && (
          <p className="text-sm leading-normal text-muted-foreground">{joinedLabel}</p>
        )}
        {actions}
      </div>
    </article>
  );
}

export { MemberPage };
