import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
  useSignOut,
  useToast,
} from "@repo/ui";
import { ChevronDownIcon } from "lucide-react";
import { useEffect } from "react";

import type { ReactElement } from "react";

function AccountMenu({
  collapsed,
  email,
  name,
}: Readonly<{ collapsed: boolean; email: string; name: string }>): ReactElement {
  const { action, signOut } = useSignOut();
  const notify = useToast();
  useEffect(() => {
    if (action.error !== undefined) {
      notify("error", action.error);
    }
  }, [action.error, notify]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${name} のアカウントメニュー`}>
        {collapsed ? null : (
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="max-w-40 truncate text-sm leading-tight font-bold">{name}</span>
            <span className="max-w-40 truncate text-sm leading-tight text-muted-foreground">
              {email}
            </span>
          </span>
        )}
        <Icon icon={ChevronDownIcon} size="small" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuLinkItem to="/security">セキュリティ</DropdownMenuLinkItem>
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
