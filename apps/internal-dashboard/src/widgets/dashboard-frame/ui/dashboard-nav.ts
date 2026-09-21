import { STAFF_PERMISSION, grantsStaffLevel, type StaffPermission } from "@repo/config";
import {
  FlagIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  UsersIcon,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

type DashboardNavPath = "/" | "/audit" | "/flags" | "/inquiries" | "/staff";

type DashboardNavItem = Readonly<{
  icon: LucideIcon;
  label: string;
  requires: StaffPermission;
  to: DashboardNavPath;
}>;

type DashboardNavGroup = Readonly<{
  items: readonly DashboardNavItem[];
  label: string;
}>;

const dashboardNavGroups: readonly DashboardNavGroup[] = [
  {
    items: [
      { icon: LayoutDashboardIcon, label: "概要", requires: STAFF_PERMISSION.viewer, to: "/" },
      {
        icon: MessageSquareIcon,
        label: "問い合わせ",
        requires: STAFF_PERMISSION.viewer,
        to: "/inquiries",
      },
      { icon: ScrollTextIcon, label: "監査ログ", requires: STAFF_PERMISSION.viewer, to: "/audit" },
    ],
    label: "状況",
  },
  {
    items: [
      { icon: FlagIcon, label: "機能フラグ", requires: STAFF_PERMISSION.viewer, to: "/flags" },
      { icon: UsersIcon, label: "メンバー", requires: STAFF_PERMISSION.editor, to: "/staff" },
    ],
    label: "運営",
  },
];

function visibleNavGroups(held: string | null): readonly DashboardNavGroup[] {
  return dashboardNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => grantsStaffLevel(held, item.requires)),
    }))
    .filter((group) => group.items.length > 0);
}

const dashboardPageTitles: Readonly<Record<DashboardNavPath | "/security", string>> = {
  "/": "概要",
  "/audit": "監査ログ",
  "/flags": "機能フラグ",
  "/inquiries": "問い合わせ",
  "/security": "セキュリティ",
  "/staff": "メンバー",
};

export { dashboardPageTitles, visibleNavGroups };
export type { DashboardNavPath };
