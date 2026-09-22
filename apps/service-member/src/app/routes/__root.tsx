import { FieldValidationMessageProvider } from "@repo/ui";
import { AppShell, appHead } from "@repo/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => {
    const locale = getLocale();
    return (
      <AppShell lang={locale} routes={routes}>
        <FieldValidationMessageProvider messages={fieldValidationMessages(locale)}>
          <Outlet />
        </FieldValidationMessageProvider>
      </AppShell>
    );
  },
  head: () => appHead(serviceName, styles),
});

export { Route };
