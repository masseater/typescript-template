import { MenuIcon } from "lucide-react";
import type { ReactElement } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
} from "@template/ui";

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="メニュー">
        <Icon icon={MenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem to="/users/$id" params={{ id: userId }}>
          ホーム
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem to="/users">ユーザーを探す</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CompactNavigation };
