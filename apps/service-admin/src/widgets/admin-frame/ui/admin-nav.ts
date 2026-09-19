import { FileTextIcon, FlagIcon, MessageSquareIcon, ShieldIcon, UsersIcon } from "lucide-react";

import type { LucideIcon } from "lucide-react";

type AdminNavPath = "/admins" | "/inquiries" | "/members" | "/reports" | "/terms";

type AdminNavItem = Readonly<{
  badge?: number;
  icon: LucideIcon;
  label: string;
  to: AdminNavPath;
}>;

type AdminNavGroup = Readonly<{
  items: readonly AdminNavItem[];
  label: string;
}>;

const adminNavGroups: readonly AdminNavGroup[] = [
  {
    items: [
      { badge: 3, icon: UsersIcon, label: "利用者", to: "/members" },
      { badge: 5, icon: MessageSquareIcon, label: "問い合わせ", to: "/inquiries" },
      { badge: 2, icon: FlagIcon, label: "通報", to: "/reports" },
    ],
    label: "運用",
  },
  {
    items: [
      { icon: FileTextIcon, label: "規約", to: "/terms" },
      { icon: ShieldIcon, label: "管理者", to: "/admins" },
    ],
    label: "設定",
  },
];

const adminPageTitles: Readonly<Record<AdminNavPath | "/security", string>> = {
  "/admins": "管理者",
  "/inquiries": "問い合わせ",
  "/members": "利用者の一覧",
  "/reports": "通報",
  "/security": "セキュリティ",
  "/terms": "規約",
};

export { adminNavGroups, adminPageTitles };
export type { AdminNavPath };
