import { AppDocument, appHead } from "@template/ui/shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { routes } from "#app/telemetry-routes.ts";
import { serviceName } from "#shared/config/index.ts";
import styles from "#app/styles.css?url";

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppDocument routes={routes}>
      <Outlet />
    </AppDocument>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
