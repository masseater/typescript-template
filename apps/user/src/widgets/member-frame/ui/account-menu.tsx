import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@template/ui/ui";
import { ChevronDownIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useSignOut } from "@template/ui";

const profileEditLink = <Link to="/settings/profile" />;
const securityLink = <Link to="/security" />;

function AccountMenu({ name }: Readonly<{ name: string }>): ReactElement {
  const { action, signOut } = useSignOut("/");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${name} のアカウントメニュー`}>
        <span className="max-w-48 truncate">{name}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={profileEditLink}>プロフィールの編集</DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={securityLink}>認証設定</DropdownMenuLinkItem>
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
