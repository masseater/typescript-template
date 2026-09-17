import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@template/ui/ui";
import { MenuIcon } from "lucide-react";
import { ProfileLink } from "#shared/ui/index.ts";
import type { ReactElement } from "react";
import { useMemo } from "react";

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const homeLink = useMemo(() => <ProfileLink id={userId} />, [userId]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="メニュー">
        <MenuIcon aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={homeLink}>ホーム</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CompactNavigation };
