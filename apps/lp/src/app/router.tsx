import { createRouter } from "@tanstack/react-router";
import type { Router } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

export type AppRouter = Router<typeof routeTree>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

export const getRouter = (): AppRouter => createRouter({ routeTree });
