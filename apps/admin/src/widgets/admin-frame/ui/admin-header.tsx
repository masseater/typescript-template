import { Icon, NavigationLink } from "@template/ui";
import { MenuIcon } from "lucide-react";

import { serviceName } from "#shared/config/index.ts";
import { AccountMenu } from "./account-menu.tsx";

import type { ReactElement } from "react";

const AdminHeader = ({
  email,
  navigationOpen,
  onToggleNavigation,
}: Readonly<{
  email: string;
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}>): ReactElement => {
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
        <Icon icon={MenuIcon} />
      </button>
      <NavigationLink to="/" variant="brand">
        {serviceName}
      </NavigationLink>
      <div className="ml-auto">
        <AccountMenu email={email} />
      </div>
    </header>
  );
};

export { AdminHeader };
