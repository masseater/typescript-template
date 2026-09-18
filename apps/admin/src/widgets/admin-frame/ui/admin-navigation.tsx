import { AdminNavigationItem } from "./admin-navigation-item.tsx";
import type { ReactElement } from "react";

const items = [
  { label: "ユーザー一覧", to: "/" },
  { label: "認証設定", to: "/security" },
] as const;

function AdminNavigation({
  onNavigate,
  open,
}: Readonly<{ onNavigate: () => void; open: boolean }>): ReactElement {
  return (
    <nav
      id="admin-navigation"
      aria-label="メイン"
      className={`border-b border-border bg-card md:block md:w-48 md:shrink-0 md:border-r md:border-b-0 ${open ? "block" : "hidden"}`}
    >
      <ul className="flex flex-col gap-1 p-2">
        {items.map((item) => (
          <AdminNavigationItem
            key={item.to}
            label={item.label}
            to={item.to}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

export { AdminNavigation };
