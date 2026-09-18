import { RootDocument } from "./-root-document.tsx";
import { appHead } from "@repo/ui/shell";
import { createRootRoute } from "@tanstack/react-router";
import { serviceName } from "#shared/config/index.ts";
import styles from "#app/styles.css?url";

const Route = createRootRoute({
  component: RootDocument,
  head: () => appHead(serviceName, styles),
});

export { Route };
