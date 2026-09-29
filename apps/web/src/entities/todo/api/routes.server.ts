import { Effect } from "effect";

import { createRouter } from "#/shared/api/index.server";
import { db } from "#/shared/db/client.server";
import { FeatureFlags, featureFlagsLive } from "#/shared/flags/index.server";
import { telemetryLive } from "#/shared/telemetry/index.server";

import { todo } from "../model/todo.table";

const listTodos = Effect.gen(function* () {
  const flags = yield* FeatureFlags;
  const includeDone = yield* flags.getBoolean("show-done-todos", true);
  const rows = yield* Effect.promise(() => db.select().from(todo));
  return includeDone ? rows : rows.filter((row) => row.status === "open");
}).pipe(Effect.withSpan("todo.list"));

export const todoRoutes = createRouter("/api/todos").get("/", () =>
  Effect.runPromise(listTodos.pipe(Effect.provide([featureFlagsLive, telemetryLive]))),
);

export type TodoRoutes = typeof todoRoutes;
