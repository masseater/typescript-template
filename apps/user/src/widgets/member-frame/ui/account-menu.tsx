import { Menu, MenuActionItem, MenuLinkItem } from "@template/ui/ui";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useSignOut } from "@template/ui";

const profileEditLink = <Link to="/settings/profile" />;
const securityLink = <Link to="/security" />;

function AccountMenu({ name }: Readonly<{ name: string }>): ReactElement {
  const { action, signOut } = useSignOut("/");
  return (
    <Menu label="アカウントのメニュー" trigger={name}>
      <MenuLinkItem render={profileEditLink}>プロフィールの編集</MenuLinkItem>
      <MenuLinkItem render={securityLink}>認証設定</MenuLinkItem>
      <MenuActionItem disabled={action.blocked} onSelect={signOut}>
        ログアウト
      </MenuActionItem>
    </Menu>
  );
}

export { AccountMenu };
