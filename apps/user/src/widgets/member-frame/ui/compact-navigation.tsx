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

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const homeLink = <Link to="/users/$id" params={{ id: userId }} />;
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
