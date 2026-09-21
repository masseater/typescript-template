import { AccountMenu } from "@repo/auth-ui";
import { AppFrame, ButtonLink, Icon } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import {
  collapsedDashboardMark,
  dashboardNavGroups,
  dashboardPageTitles,
  dashboardProductName,
} from "./dashboard-nav.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function dashboardTitle(pathname: string): string {
  if (pathname in dashboardPageTitles) {
    return dashboardPageTitles[pathname as keyof typeof dashboardPageTitles];
  }
  return dashboardProductName;
}

function DashboardFrame({
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
      collapsedMark={collapsedDashboardMark}
      defaultCollapsed={defaultCollapsed}
      footer={({ collapsed }) => <AccountMenu collapsed={collapsed} email={email} name={name} />}
      headerActions={
        <>
          <a
            href="https://analytics.google.com/"
            rel="noreferrer"
            target="_blank"
            className="ml-auto rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer"
          >
            Google Analytics
          </a>
          <ButtonLink to="/wiki" variant="secondary">
            Wiki
          </ButtonLink>
        </>
      }
      navigationId="dashboard-navigation"
      productName={dashboardProductName}
      sections={dashboardNavGroups.map((section) => ({
        destinations: section.items.map((destination) => ({
          icon: <Icon icon={destination.icon} />,
          label: destination.label,
          to: destination.to,
        })),
        label: section.label,
      }))}
      subtitle="状況と運営"
      title={dashboardTitle(pathname)}
    >
      {children}
    </AppFrame>
  );
}

export { DashboardFrame };
