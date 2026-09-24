import { AppShell } from "@repo/ui/shell";

import { MemberAnalyticsNavigation } from "./navigation.tsx";

import type { FieldValidationMessages } from "@repo/ui";
import type { ReactElement, ReactNode } from "react";

function MemberShell({
  children,
  fieldValidationMessages,
  lang,
  routes,
}: Readonly<{
  children: ReactNode;
  fieldValidationMessages: FieldValidationMessages;
  lang: string;
  routes: Readonly<Record<string, string>>;
}>): ReactElement {
  return (
    <AppShell fieldValidationMessages={fieldValidationMessages} lang={lang} routes={routes}>
      <MemberAnalyticsNavigation />
      {children}
    </AppShell>
  );
}

export { MemberShell };
