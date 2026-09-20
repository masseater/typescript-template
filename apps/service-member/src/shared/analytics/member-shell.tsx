import { AppShell } from "@repo/ui/shell";

import { MemberAnalyticsNavigation } from "./navigation.tsx";

import type { ReactElement, ReactNode } from "react";

function MemberShell({
  children,
  routes,
}: Readonly<{ children: ReactNode; routes: Readonly<Record<string, string>> }>): ReactElement {
  return (
    <AppShell routes={routes}>
      <MemberAnalyticsNavigation />
      {children}
    </AppShell>
  );
}

export { MemberShell };
