import { appHead } from "@repo/ui/shell";
import { createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { RootDocument } from "./-root-document.tsx";

import type { QueryClient } from "@tanstack/react-query";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootDocument,
  head: () => appHead(serviceName, styles),
});

export { Route };
