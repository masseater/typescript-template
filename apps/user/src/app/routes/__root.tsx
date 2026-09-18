import { AppShell, appHead } from "@repo/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppShell routes={routes}>
      <Outlet />
    </AppShell>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
