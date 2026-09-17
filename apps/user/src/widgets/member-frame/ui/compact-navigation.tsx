import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
} from "@template/ui/ui";
import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useMemo } from "react";

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const home = useMemo(() => ({ id: userId }), [userId]);
  const homeLink = useMemo(() => <Link to="/users/$id" params={home} />, [home]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="メニュー">
        <Icon icon={MenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={homeLink}>ホーム</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CompactNavigation };
