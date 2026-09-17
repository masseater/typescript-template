import { AccountMenu } from "#components/account-menu.tsx";
import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import type { ReactElement } from "react";

function AdminHeader({
  email,
  navigationOpen,
  onToggleNavigation,
}: Readonly<{
  email: string;
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}>): ReactElement {
  return (
    <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2 shadow-sm">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={navigationOpen}
        aria-controls="admin-navigation"
        onClick={onToggleNavigation}
        className="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"
      >
        <MenuIcon aria-hidden="true" className="size-5" />
      </button>
      <Link
        to="/"
        className="text-lg leading-tight font-bold text-foreground outline-none focus-visible:focus-indicator-outer"
      >
        管理画面
      </Link>
      <div className="ml-auto">
        <AccountMenu email={email} />
      </div>
    </header>
  );
}

export { AdminHeader };
