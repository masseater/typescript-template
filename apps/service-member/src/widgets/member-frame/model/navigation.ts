import { HomeIcon, SquareStackIcon, UserRoundIcon } from "lucide-react";

import { m } from "#shared/i18n/index.ts";

import type { LucideIcon } from "lucide-react";

type MemberNavItem = Readonly<
  | {
      icon: LucideIcon;
      id: "board";
      label: string;
      to: "/board";
    }
  | {
      icon: LucideIcon;
      id: "home";
      label: string;
      to: "/home";
    }
  | {
      icon: LucideIcon;
      id: "profile";
      label: string;
      params: { readonly id: string };
      to: "/users/$id";
    }
>;

function memberNavItems(memberBoard: boolean, profileId: string): readonly MemberNavItem[] {
  return [
    { icon: HomeIcon, id: "home", label: m.nav_home(), to: "/home" },
    {
      icon: UserRoundIcon,
      id: "profile",
      label: m.nav_profile(),
      params: { id: profileId },
      to: "/users/$id",
    },
    ...(memberBoard
      ? [
          {
            icon: SquareStackIcon,
            id: "board",
            label: m.nav_board(),
            to: "/board",
          } satisfies MemberNavItem,
        ]
      : []),
  ];
}

const memberPageTitles = {
  "/board": m.nav_board,
  "/home": m.nav_home,
  "/messages": m.title_messages,
  "/notifications": m.title_notifications,
  "/search": m.title_search,
  "/support": m.title_support,
  "/upgrade": m.title_upgrade,
  "/users": m.title_users,
} as const;

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/users/")) {
    return m.nav_profile();
  }
  if (pathname.startsWith("/settings")) {
    return m.title_settings();
  }
  if (pathname.startsWith("/board/")) {
    return m.title_thread();
  }
  if (pathname.startsWith("/messages/")) {
    return m.title_conversation();
  }
  if (pathname.startsWith("/support/")) {
    return m.title_support();
  }
  if (pathname in memberPageTitles) {
    return memberPageTitles[pathname as keyof typeof memberPageTitles]();
  }
  return m.title_member();
}

export { memberNavItems, titleForPath };
