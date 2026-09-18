import { RootLayout } from "./-root-layout.tsx";
import type { RouterContext } from "#app/router-context.ts";
import { appHead } from "@template/ui/shell";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { serviceName } from "#shared/config/index.ts";
import styles from "#app/styles.css?url";

const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  head: () => appHead(serviceName, styles),
});

export { Route };
