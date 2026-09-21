import { AppShell } from "@repo/ui/shell";

import { MemberAnalyticsNavigation } from "./navigation.tsx";

import type { ReactElement, ReactNode } from "react";

function MemberShell({
  children,
  lang,
  routes,
}: Readonly<{
  children: ReactNode;
  lang: string;
  routes: Readonly<Record<string, string>>;
}>): ReactElement {
  return (
    <AppShell lang={lang} routes={routes}>
      <MemberAnalyticsNavigation />
      {children}
    </AppShell>
  );
}

export { MemberShell };
