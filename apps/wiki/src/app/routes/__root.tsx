import { createRootRoute } from "@tanstack/react-router";
import { appHead } from "@template/ui/shell";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { RootDocument } from "./-root-document.tsx";

const Route = createRootRoute({
  component: RootDocument,
  head: () => appHead(serviceName, styles),
});

export { Route };
