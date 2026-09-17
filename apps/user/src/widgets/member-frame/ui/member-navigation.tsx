import { CompactNavigation } from "./compact-navigation.tsx";
import { ProfileLink } from "#shared/ui/index.ts";
import type { ReactElement } from "react";

const linkClassName =
  "rounded-md px-3 py-2 text-base leading-tight font-bold text-foreground no-underline hover:bg-card-hover aria-[current=page]:bg-secondary";

function MemberNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  return (
    <>
      <nav aria-label="メイン" className="hidden items-center gap-1 md:flex">
        <ProfileLink id={userId} className={linkClassName}>
          ホーム
        </ProfileLink>
      </nav>
      <div className="md:hidden">
        <CompactNavigation userId={userId} />
      </div>
    </>
  );
}

export { MemberNavigation };
