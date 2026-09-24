import { Outlet } from "@tanstack/react-router";

import { AppShell } from "./app-shell";

import type { ReactElement } from "react";
import type { FieldValidationMessages } from "./shared/ui/field-validation-messages";

const LocalizedAppShell = <Locale extends string>({
  fieldValidationMessages,
  getLocale,
  routes,
}: Readonly<{
  fieldValidationMessages: (locale: Locale) => FieldValidationMessages;
  getLocale: () => Locale;
  routes: Readonly<Record<string, string>>;
}>): ReactElement => {
  const locale = getLocale();
  return (
    <AppShell
      fieldValidationMessages={fieldValidationMessages(locale)}
      lang={locale}
      routes={routes}
    >
      <Outlet />
    </AppShell>
  );
};

export { LocalizedAppShell };
