import { run } from "@r_masseater/workers-tracing/effect";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { browserClient, createQueries, serverClient } from "#/shared/api";

import type { TodoRoutes } from "./routes.server";

const loadTodoHandle = (): Promise<(request: Request) => Promise<Response>> =>
  run(
    Effect.promise(() => import("./routes.server")).pipe(
      Effect.map((module) => module.handleTodos),
    ),
  );

const client = createIsomorphicFn()
  .server(() => serverClient<TodoRoutes>(loadTodoHandle))
  .client(() => browserClient<TodoRoutes>());

const todoQueries = createQueries<TodoRoutes>(client());

export { todoQueries };
