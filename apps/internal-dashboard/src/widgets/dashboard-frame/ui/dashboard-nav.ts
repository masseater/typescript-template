import {
  FlagIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  MicIcon,
  ScrollTextIcon,
  UsersIcon,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

type DashboardNavPath = "/" | "/audit" | "/flags" | "/inquiries" | "/recordings" | "/staff";

type DashboardNavItem = Readonly<{
  icon: LucideIcon;
  label: string;
  to: DashboardNavPath;
}>;

type DashboardNavGroup = Readonly<{
  items: readonly DashboardNavItem[];
  label: string;
}>;

const dashboardNavGroups: readonly DashboardNavGroup[] = [
  {
    items: [
      { icon: LayoutDashboardIcon, label: "概要", to: "/" },
      { icon: MessageSquareIcon, label: "問い合わせ", to: "/inquiries" },
      { icon: MicIcon, label: "録音", to: "/recordings" },
      { icon: ScrollTextIcon, label: "監査ログ", to: "/audit" },
    ],
    label: "状況",
  },
  {
    items: [
      { icon: FlagIcon, label: "機能フラグ", to: "/flags" },
      { icon: UsersIcon, label: "メンバー", to: "/staff" },
    ],
    label: "運営",
  },
];

const dashboardPageTitles: Readonly<Record<DashboardNavPath | "/security", string>> = {
  "/": "概要",
  "/audit": "監査ログ",
  "/flags": "機能フラグ",
  "/inquiries": "問い合わせ",
  "/recordings": "録音",
  "/security": "セキュリティ",
  "/staff": "メンバー",
};

const dashboardProductName = "社内ダッシュボード";

const collapsedDashboardMark = "社内";

export { collapsedDashboardMark, dashboardNavGroups, dashboardPageTitles, dashboardProductName };
export type { DashboardNavGroup, DashboardNavItem, DashboardNavPath };
