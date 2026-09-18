import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { serviceName } from "#shared/config/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { AppShell, appHead } from "@repo/ui/shell";

import styles from "#app/styles.css?url";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => (
    <AppShell routes={routes}>
      <Outlet />
    </AppShell>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
