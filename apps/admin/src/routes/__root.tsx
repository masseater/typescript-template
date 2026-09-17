import { AppShell, appHead } from "@template/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { ToastProvider } from "@template/ui/ui";
import { routes } from "#telemetry-routes.ts";
import styles from "#styles.css?url";

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppShell routes={routes}>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AppShell>
  ),
  head: () => appHead("管理画面", styles),
});

export { Route };
