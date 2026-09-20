import { AccountMenu as SessionMenu } from "@repo/auth-ui";
import { DropdownMenuLinkItem, Icon } from "@repo/ui";
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
  return (
    <SessionMenu
      destination="/"
      items={
        <>
          <DropdownMenuLinkItem params={{ id: userId }} to="/users/$id">
            プロフィール
          </DropdownMenuLinkItem>
          <DropdownMenuLinkItem to="/settings">設定</DropdownMenuLinkItem>
          <DropdownMenuLinkItem to="/support">お問い合わせ</DropdownMenuLinkItem>
        </>
      }
      label={name}
      trigger={
        compact ? (
          <Icon icon={UserRoundIcon} />
        ) : (
          <>
            <span className="max-w-48 truncate">{name}</span>
            <Icon icon={ChevronDownIcon} size="small" />
          </>
        )
      }
    />
  );
}

export { AccountMenu };
