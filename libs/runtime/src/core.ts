import { APPLICATION, type Application } from "@repo/config";
import {
  AdminRpcs,
  InternalRpcs,
  MemberRpcs,
  SessionInvalid,
  SessionRequired,
  forwardAuthRequest,
  makeCoreClient,
  withForwardedCookies,
} from "@repo/core-api";
import { Context, Effect } from "effect";

import type { DatabaseFailure } from "@repo/db";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type { SessionView } from "./contracts.ts";

type CoreShape = {
  readonly audience: Application;
  readonly fetcher: Fetcher;
};

class Core extends Context.Service<Core, CoreShape>()("@repo/runtime/Core") {}

type SessionRpcError = SessionInvalid | SessionRequired | RpcClientError;
type CoreReadyError = DatabaseFailure | RpcClientError;

const forwardAuth = (request: Request): Effect.Effect<Response, never, Core> =>
  Effect.gen(function* forwardAuthProgram() {
    const { fetcher } = yield* Core;
    return yield* Effect.promise(() => forwardAuthRequest(fetcher, request));
  });

const readSession = (
  request: Request,
): Effect.Effect<typeof SessionView.Type, SessionRpcError, Core> =>
  Effect.gen(function* readSessionProgram() {
    const { audience, fetcher } = yield* Core;
    return yield* Effect.scoped(
      Effect.gen(function* sessionRpc() {
        if (audience === APPLICATION.user) {
          const client = yield* makeCoreClient(MemberRpcs, fetcher);
          const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
          return { strong: identity.strong, user: identity.user };
        }
        if (audience === APPLICATION.admin) {
          const client = yield* makeCoreClient(AdminRpcs, fetcher);
          const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
          return { strong: identity.strong, user: identity.user };
        }
        const client = yield* makeCoreClient(InternalRpcs, fetcher);
        const identity = yield* client.getSession({}).pipe(withForwardedCookies(request.headers));
        return { strong: identity.strong, user: identity.user };
      }),
    );
  });

const ensureCoreReady = (): Effect.Effect<void, CoreReadyError, Core> =>
  Effect.gen(function* ensureCoreReadyProgram() {
    const { audience, fetcher } = yield* Core;
    yield* Effect.scoped(
      Effect.gen(function* readyRpc() {
        if (audience === APPLICATION.user) {
          const client = yield* makeCoreClient(MemberRpcs, fetcher);
          yield* client.databaseReady({});
          return;
        }
        const client = yield* makeCoreClient(
          audience === APPLICATION.admin ? AdminRpcs : InternalRpcs,
          fetcher,
        );
        yield* client.ready({});
      }),
    );
  });

export { Core, ensureCoreReady, forwardAuth, readSession };
export type { CoreReadyError, CoreShape, SessionRpcError };
