import { FieldValidationMessageProvider, ToastProvider } from "@repo/ui";
import { AppShell, appHead } from "@repo/ui/shell";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => {
    const locale = getLocale();
    return (
      <AppShell lang={locale} routes={routes}>
        <FieldValidationMessageProvider messages={fieldValidationMessages(locale)}>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </FieldValidationMessageProvider>
      </AppShell>
    );
  },
  head: () => appHead(serviceName, styles),
});

export { Route };
