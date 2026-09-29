import { createIsomorphicFn } from "@tanstack/react-start";

import { browserClient, createQueries, serverClient } from "#/shared/api";

import type { TodoRoutes } from "./routes.server";

const client = createIsomorphicFn()
  .server(() => serverClient<TodoRoutes>(async () => (await import("./routes.server")).todoRoutes))
  .client(() => browserClient<TodoRoutes>());

export const todoQueries = createQueries<TodoRoutes>(client());
