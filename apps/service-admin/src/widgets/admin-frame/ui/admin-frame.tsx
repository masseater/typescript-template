import { AccountMenu } from "@repo/auth-ui";
import { AppFrame, Icon } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import {
  adminNavGroups,
  adminPageTitles,
  adminProductName,
  collapsedAdminMark,
} from "./admin-nav.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function adminTitle(pathname: string): string {
  if (pathname.startsWith("/members/")) {
    return "利用者の詳細";
  }
  if (pathname in adminPageTitles) {
    return adminPageTitles[pathname as keyof typeof adminPageTitles];
  }
  return adminProductName;
}

function AdminFrame({
  children,
  defaultCollapsed = false,
  email,
  name,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  defaultCollapsed?: boolean;
  email: string;
  name: string;
}>): ReactElement {
  const { pathname } = useLocation();
  return (
    <AppFrame
      collapsedMark={collapsedAdminMark}
      defaultCollapsed={defaultCollapsed}
      footer={({ collapsed }) => <AccountMenu collapsed={collapsed} email={email} name={name} />}
      navigationId="admin-navigation"
      productName={adminProductName}
      sections={adminNavGroups.map((section) => ({
        destinations: section.items.map((destination) => ({
          ...(destination.badge === undefined ? {} : { badge: destination.badge }),
          icon: <Icon icon={destination.icon} />,
          label: destination.label,
          to: destination.to,
        })),
        label: section.label,
      }))}
      subtitle="運用コンソール"
      title={adminTitle(pathname)}
    >
      {children}
    </AppFrame>
  );
}

export { AdminFrame };
