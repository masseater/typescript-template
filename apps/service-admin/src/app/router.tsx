import { createAppRouter } from "@repo/ui/shell";

import { deLocalizeUrl, localizeUrl } from "#shared/i18n/index.ts";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  return createAppRouter(routeTree, {
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}

export { getRouter };
