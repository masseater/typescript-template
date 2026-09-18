import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  type Register = {
    router: ReturnType<typeof getRouter>;
  };
}

const getRouter = (): ReturnType<typeof createRouter<typeof routeTree>> => {
  return createRouter({
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });
};

export { getRouter };
