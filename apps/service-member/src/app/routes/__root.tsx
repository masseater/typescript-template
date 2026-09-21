import { AppShell, appHead } from "@repo/ui/shell";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => (
    <AppShell lang={getLocale()} routes={routes}>
      <Outlet />
    </AppShell>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
