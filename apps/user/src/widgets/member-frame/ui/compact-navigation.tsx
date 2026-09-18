import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
} from "@template/ui";
import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import type { ReactElement } from "react";

const usersLink = <Link to="/users" />;

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const homeLink = <Link to="/users/$id" params={{ id: userId }} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="メニュー">
        <Icon icon={MenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={homeLink}>ホーム</DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={usersLink}>ユーザーを探す</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CompactNavigation };
