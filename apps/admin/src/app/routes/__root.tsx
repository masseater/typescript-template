import { AppShell, appHead } from "@template/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { ToastProvider } from "@template/ui/ui";
import { routes } from "#shared/telemetry/index.ts";
import { serviceName } from "#shared/config/index.ts";
import styles from "#app/styles.css?url";

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
