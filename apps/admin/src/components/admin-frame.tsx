import type { ReactElement, ReactNode, ReactPortal } from "react";
import { AdminHeader } from "#components/admin-header.tsx";
import { AdminNavigation } from "#components/admin-navigation.tsx";
import { useState } from "react";

function AdminFrame({
  children,
  email,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>>; email: string }>): ReactElement {
  const [navigationOpen, setNavigationOpen] = useState(false);
  function toggleNavigation(): void {
    setNavigationOpen((open) => !open);
  }
  function closeNavigation(): void {
    setNavigationOpen(false);
  }
  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader
        email={email}
        navigationOpen={navigationOpen}
        onToggleNavigation={toggleNavigation}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNavigation open={navigationOpen} onNavigate={closeNavigation} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export { AdminFrame };
