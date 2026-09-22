import {
  AdminRpcs,
  InternalRpcs,
  MemberProfileNotFound,
  MemberRpcs,
  SessionIdentity,
  type MemberProfileUpdate,
  type MemberProfileView,
  type SessionIdentityView,
} from "@repo/core-api";
import { APPLICATION } from "@repo/config";
import { checkDatabase, Database, type DatabaseFailure } from "@repo/db";
import { Effect } from "effect";
import * as Layer from "effect/Layer";

import type { Rpc } from "effect/unstable/rpc";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CoreBindings } from "./bindings.ts";
import { readMemberProfile, writeMemberProfile } from "./member-profile.ts";
import { sessionIdentityMiddleware } from "./session-middleware.ts";

const memberHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  Rpc.ToHandler<RpcGroup.Rpcs<typeof MemberRpcs>> | Rpc.Middleware<RpcGroup.Rpcs<typeof MemberRpcs>>
> =>
  Layer.mergeAll(
    MemberRpcs.toLayer({
      databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
        checkDatabase().pipe(Effect.as(true)),
      getMemberProfile: (): Effect.Effect<
        typeof MemberProfileView.Type,
        MemberProfileNotFound,
        SessionIdentity | Database
      > =>
        Effect.gen(function* getMemberProfile() {
          const identity = yield* SessionIdentity;
          return yield* readMemberProfile(identity.user.id);
        }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure))),
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      updateMemberProfile: (
        update: typeof MemberProfileUpdate.Type,
      ): Effect.Effect<
        typeof MemberProfileView.Type,
        MemberProfileNotFound,
        SessionIdentity | Database
      > =>
        Effect.gen(function* updateMemberProfile() {
          const identity = yield* SessionIdentity;
          return yield* writeMemberProfile(identity.user.id, update);
        }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure))),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.user),
  ).pipe(Layer.provide(Database.layer(bindings.DB)));

const adminHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  Rpc.ToHandler<RpcGroup.Rpcs<typeof AdminRpcs>> | Rpc.Middleware<RpcGroup.Rpcs<typeof AdminRpcs>>
> =>
  Layer.mergeAll(
    AdminRpcs.toLayer({
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      ready: (): Effect.Effect<boolean> => Effect.succeed(true),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.admin),
  ).pipe(Layer.provide(Database.layer(bindings.DB)));

const internalHandlers = (
  bindings: CoreBindings,
): Layer.Layer<
  | Rpc.ToHandler<RpcGroup.Rpcs<typeof InternalRpcs>>
  | Rpc.Middleware<RpcGroup.Rpcs<typeof InternalRpcs>>
> =>
  Layer.mergeAll(
    InternalRpcs.toLayer({
      getSession: (): Effect.Effect<typeof SessionIdentityView.Type, never, SessionIdentity> =>
        SessionIdentity,
      ready: (): Effect.Effect<boolean> => Effect.succeed(true),
    }),
    sessionIdentityMiddleware(bindings, APPLICATION.wiki),
  ).pipe(Layer.provide(Database.layer(bindings.DB)));

export { adminHandlers, internalHandlers, memberHandlers };
