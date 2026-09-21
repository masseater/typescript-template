import {
  BellIcon,
  HomeIcon,
  MessageCircleIcon,
  SearchIcon,
  SquareStackIcon,
  UserRoundIcon,
} from "lucide-react";

import { m } from "#shared/i18n/index.ts";

import type { LucideIcon } from "lucide-react";

type MemberNavItem = Readonly<
  | {
      badge?: number;
      icon: LucideIcon;
      id: "board";
      label: string;
      to: "/board";
    }
  | {
      badge?: number;
      icon: LucideIcon;
      id: "home";
      label: string;
      to: "/home";
    }
  | {
      badge?: number;
      icon: LucideIcon;
      id: "messages";
      label: string;
      to: "/messages";
    }
  | {
      badge?: number;
      icon: LucideIcon;
      id: "notifications";
      label: string;
      to: "/notifications";
    }
  | {
      badge?: number;
      icon: LucideIcon;
      id: "profile";
      label: string;
      params: { readonly id: string };
      to: "/users/$id";
    }
  | {
      badge?: number;
      icon: LucideIcon;
      id: "search";
      label: string;
      paid: true;
      to: "/search" | "/upgrade";
    }
>;

const memberHasPaidPlan = false;

type NavBadges = Readonly<{
  notifications: number;
}>;

const emptyNavBadges: NavBadges = { notifications: 0 };

function memberNavItems(
  paid: boolean,
  memberBoard: boolean,
  profileId: string,
  badges: NavBadges = emptyNavBadges,
): readonly MemberNavItem[] {
  return [
    { icon: HomeIcon, id: "home", label: m.nav_home(), to: "/home" },
    {
      icon: UserRoundIcon,
      id: "profile",
      label: m.nav_profile(),
      params: { id: profileId },
      to: "/users/$id",
    },
    {
      icon: SearchIcon,
      id: "search",
      label: m.title_search(),
      paid: true,
      to: paid ? "/search" : "/upgrade",
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
    {
      badge: 0,
      icon: MessageCircleIcon,
      id: "messages",
      label: m.title_messages(),
      to: "/messages",
    },
    {
      badge: badges.notifications,
      icon: BellIcon,
      id: "notifications",
      label: m.title_notifications(),
      to: "/notifications",
    },
  ];
}

const memberPageTitles = {
  "/agreement": () => "規約への同意",
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
  if (pathname.startsWith("/groups/")) {
    return "グループ";
  }
  if (pathname.startsWith("/support/")) {
    return m.title_support();
  }
  if (pathname in memberPageTitles) {
    return memberPageTitles[pathname as keyof typeof memberPageTitles]();
  }
  return m.title_member();
}

export { memberHasPaidPlan, memberNavItems, titleForPath };
export type { MemberNavItem, NavBadges };
