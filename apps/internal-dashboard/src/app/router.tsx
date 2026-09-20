import { createAppRouter } from "@repo/ui/shell";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  return createAppRouter(routeTree);
}

export { getRouter };
