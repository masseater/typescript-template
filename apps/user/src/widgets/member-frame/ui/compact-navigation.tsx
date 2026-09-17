import { Menu, MenuLinkItem } from "@template/ui/ui";
import { MenuIcon } from "lucide-react";
import { ProfileLink } from "#shared/ui/index.ts";
import type { ReactElement } from "react";
import { useMemo } from "react";

const menuIcon = <MenuIcon aria-hidden="true" className="size-5" />;

function CompactNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const homeLink = useMemo(() => <ProfileLink id={userId} />, [userId]);
  return (
    <Menu align="start" label="メニュー" trigger={menuIcon}>
      <MenuLinkItem render={homeLink}>ホーム</MenuLinkItem>
    </Menu>
  );
}

export { CompactNavigation };
