import { BellIcon, HomeIcon, MessageCircleIcon, SearchIcon, SquareStackIcon } from "lucide-react";

import type { LucideIcon } from "lucide-react";

type MemberNavId = "board" | "home" | "messages" | "notifications" | "search";

type MemberNavPath = "/board" | "/home" | "/messages" | "/notifications" | "/search" | "/upgrade";

type MemberNavItem = Readonly<{
  badge?: number;
  icon: LucideIcon;
  id: MemberNavId;
  label: string;
  paid?: true;
  to: MemberNavPath;
}>;

const memberHasPaidPlan = false;

type NavBadges = Readonly<{
  notifications: number;
}>;

const emptyNavBadges: NavBadges = { notifications: 0 };

function memberNavItems(
  paid: boolean,
  badges: NavBadges = emptyNavBadges,
): readonly MemberNavItem[] {
  return [
    { icon: HomeIcon, id: "home", label: "ホーム", to: "/home" },
    {
      icon: SearchIcon,
      id: "search",
      label: "探す",
      paid: true,
      to: paid ? "/search" : "/upgrade",
    },
    { icon: SquareStackIcon, id: "board", label: "掲示板", to: "/board" },
    { badge: 0, icon: MessageCircleIcon, id: "messages", label: "メッセージ", to: "/messages" },
    {
      badge: badges.notifications,
      icon: BellIcon,
      id: "notifications",
      label: "通知",
      to: "/notifications",
    },
  ];
}

const memberPageTitles: Readonly<Record<MemberNavPath | "/support" | "/users", string>> = {
  "/board": "掲示板",
  "/home": "ホーム",
  "/messages": "メッセージ",
  "/notifications": "通知",
  "/search": "探す",
  "/support": "お問い合わせ",
  "/upgrade": "有料プラン",
  "/users": "探す",
};

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/users/")) {
    return "プロフィール";
  }
  if (pathname.startsWith("/settings")) {
    return "設定";
  }
  if (pathname.startsWith("/board/")) {
    return "スレッド";
  }
  if (pathname.startsWith("/messages/")) {
    return "会話";
  }
  if (pathname.startsWith("/support/")) {
    return "お問い合わせ";
  }
  if (pathname in memberPageTitles) {
    return memberPageTitles[pathname as keyof typeof memberPageTitles];
  }
  return "会員";
}

export { memberHasPaidPlan, memberNavItems, titleForPath };
export type { MemberNavItem, NavBadges };
