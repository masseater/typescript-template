import { AccountMenu as SessionMenu } from "@repo/auth-ui";
import { DropdownMenuLinkItem, Icon } from "@repo/ui";
import { ChevronDownIcon, UserRoundIcon } from "lucide-react";

import { m } from "#shared/i18n/index.ts";

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
            {m.nav_profile()}
          </DropdownMenuLinkItem>
          <DropdownMenuLinkItem to="/settings">{m.title_settings()}</DropdownMenuLinkItem>
          <DropdownMenuLinkItem to="/support">{m.title_support()}</DropdownMenuLinkItem>
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
