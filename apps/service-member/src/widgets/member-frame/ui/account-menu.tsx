import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
  useSignOut,
} from "@repo/ui";
import { ChevronDownIcon, UserRoundIcon } from "lucide-react";

import type { ReactElement } from "react";

function AccountMenu({
  compact = false,
  name,
  userId,
}: Readonly<{
  compact?: boolean;
  name: string;
  userId: string;
}>): ReactElement {
  const { action, signOut } = useSignOut("/");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${name} のアカウントメニュー`}
        className={compact ? "w-full justify-center px-1" : undefined}
      >
        {compact ? (
          <Icon icon={UserRoundIcon} />
        ) : (
          <>
            <span className="max-w-48 truncate">{name}</span>
            <Icon icon={ChevronDownIcon} size="small" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem to="/users/$id" params={{ id: userId }}>
          プロフィール
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem to="/settings">設定</DropdownMenuLinkItem>
        <DropdownMenuLinkItem to="/support">お問い合わせ</DropdownMenuLinkItem>
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
