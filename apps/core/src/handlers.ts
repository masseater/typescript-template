import {
  AdminRpcs,
  InternalRpcs,
  MemberProfileNotFound,
  MemberProfileUpdate,
  MemberProfileView,
  MemberRpcs,
  SessionIdentity,
  SessionIdentityMiddleware,
  SessionIdentityView,
  SessionRequired,
} from "@repo/core-api";
import { checkDatabase, Database, type DatabaseFailure } from "@repo/db";
import { Effect } from "effect";
import * as Layer from "effect/Layer";

import type { Rpc } from "effect/unstable/rpc";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CoreBindings } from "./bindings.ts";

const sessionIdentityStub = (): Layer.Layer<SessionIdentityMiddleware> =>
  Layer.succeed(SessionIdentityMiddleware, () => Effect.fail(new SessionRequired()));

const memberHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  Rpc.ToHandler<RpcGroup.Rpcs<typeof MemberRpcs>> | SessionIdentityMiddleware
> =>
  Layer.mergeAll(
    MemberRpcs.toLayer({
      databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
        checkDatabase().pipe(Effect.as(true)),
      getMemberProfile: (): Effect.Effect<
        typeof MemberProfileView.Type,
        MemberProfileNotFound,
        SessionIdentity
      > =>
        Effect.gen(function* getMemberProfile() {
          yield* SessionIdentity;
          return yield* new MemberProfileNotFound();
        }),
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      updateMemberProfile: (
        _update: typeof MemberProfileUpdate.Type,
      ): Effect.Effect<typeof MemberProfileView.Type, MemberProfileNotFound, SessionIdentity> =>
        Effect.gen(function* updateMemberProfile() {
          yield* SessionIdentity;
          return yield* new MemberProfileNotFound();
        }),
    }),
    sessionIdentityStub(),
  ).pipe(Layer.provide(Database.layer(bindings.DB)));

const adminHandlers = (): Layer.Layer<Rpc.Handler<"ready">> =>
  AdminRpcs.toLayer({
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
  });

const internalHandlers = (): Layer.Layer<Rpc.Handler<"ready">> =>
  InternalRpcs.toLayer({
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
  });

export { adminHandlers, internalHandlers, memberHandlers };
