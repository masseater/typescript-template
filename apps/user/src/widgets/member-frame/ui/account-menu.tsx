import { ChevronDownIcon } from "lucide-react";
import type { ReactElement } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
  useSignOut,
} from "@repo/ui";

function AccountMenu({ name }: Readonly<{ name: string }>): ReactElement {
  const { action, signOut } = useSignOut("/");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${name} のアカウントメニュー`}>
        <span className="max-w-48 truncate">{name}</span>
        <Icon icon={ChevronDownIcon} size="small" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem to="/settings/profile">プロフィールの編集</DropdownMenuLinkItem>
        <DropdownMenuLinkItem to="/security">認証設定</DropdownMenuLinkItem>
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
