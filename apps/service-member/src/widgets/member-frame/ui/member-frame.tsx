import { AppFrame, Icon, ToastProvider } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { memberHasPaidPlan, memberNavItems, titleForPath } from "../model/navigation.ts";
import { AccountMenu } from "./account-menu.tsx";

import type { SessionView } from "@repo/auth-ui";
import type { ReactElement, ReactNode, ReactPortal } from "react";
import type { NavBadges } from "../model/navigation.ts";

const collapsedMemberMark = "ユーザー";

function memberDestinationTo(item: ReturnType<typeof memberNavItems>[number]): string {
  if (item.id === "profile") {
    return `/users/${item.params.id}`;
  }
  return item.to;
}

function MemberFrame({
  children,
  memberBoard,
  navBadges,
  user,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  memberBoard: boolean;
  navBadges: NavBadges;
  user: SessionView["user"];
}>): ReactElement {
  const { pathname } = useLocation();
  const destinations = memberNavItems(memberHasPaidPlan, memberBoard, user.id, navBadges).map(
    (item) => ({
      ...(item.badge === undefined ? {} : { badge: item.badge }),
      exact: item.id === "home",
      icon: <Icon icon={item.icon} />,
      label: item.label,
      to: memberDestinationTo(item),
    }),
  );
  return (
    <ToastProvider>
      <AppFrame
        bottomTabs
        collapsedMark={collapsedMemberMark}
        density="compact"
        footer={() => <AccountMenu compact name={user.name} userId={user.id} />}
        headerLeading={<AccountMenu compact name={user.name} userId={user.id} />}
        homeTo="/home"
        navigationId="member-navigation"
        productName={serviceName}
        sections={[{ destinations, label: "" }]}
        title={titleForPath(pathname)}
      >
        {children}
      </AppFrame>
    </ToastProvider>
  );
}

export { MemberFrame };
