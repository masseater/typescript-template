import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ToastProvider } from "@template/ui";
import { AppShell, appHead } from "@template/ui/shell";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppShell routes={routes}>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AppShell>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
