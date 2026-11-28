import { Array, Effect, pipe } from "effect";

import { FeatureFlags } from "#/pages/home/config/feature-flags.server";
import { todo } from "#/pages/home/model/todo.table";
import { createRouter } from "#/shared/api/index.server";
import { db } from "#/shared/db/index.server";

import { runRequest } from "./runtime.server.ts";

const listTodos = Effect.gen(function* listTodos() {
  const flags = yield* FeatureFlags;
  const includeDone = yield* flags.getBoolean("show-done-todos", true);
  const rows = yield* Effect.promise(() => db.select().from(todo));
  yield* Effect.logInfo("todos listed").pipe(
    Effect.annotateLogs({ includeDone, total: rows.length }),
  );
  if (includeDone) {
    return rows;
  }
  return pipe(
    rows,
    Array.filter((row) => row.status === "open"),
  );
}).pipe(Effect.withSpan("todo.list"));

export const todoRoutes = createRouter("/api/todos").get("/", () => runRequest(listTodos));

export const handleTodos = todoRoutes.handle;

export type TodoRoutes = typeof todoRoutes;
