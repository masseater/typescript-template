import { AdminRpcs, InternalRpcs, MemberRpcs } from "@repo/core-api";
import { checkDatabase, Database, type DatabaseFailure } from "@repo/db";
import { Effect } from "effect";
import * as Layer from "effect/Layer";

import type { Rpc } from "effect/unstable/rpc";
import type { CoreBindings } from "./bindings.ts";

const memberHandlers = (bindings: CoreBindings): Layer.Layer<Rpc.Handler<"databaseReady">> =>
  MemberRpcs.toLayer({
    databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
      checkDatabase().pipe(Effect.as(true)),
  }).pipe(Layer.provide(Database.layer(bindings.DB)));

const adminHandlers = (): Layer.Layer<Rpc.Handler<"ready">> =>
  AdminRpcs.toLayer({
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
  });

const internalHandlers = (): Layer.Layer<Rpc.Handler<"ready">> =>
  InternalRpcs.toLayer({
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
  });

export { adminHandlers, internalHandlers, memberHandlers };
