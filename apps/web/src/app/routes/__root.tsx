import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { RootDocument } from "#/app/shell/root-document";

import appCss from "#/app/styles.css?inline";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "web" }],
    styles: [{ children: appCss }],
  }),
  shellComponent: RootDocument,
});

export { Route };
