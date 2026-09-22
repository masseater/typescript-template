import { createRpcFetcher, isAuthForwardPath } from "@repo/core-api";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Effect } from "effect";

import { handleForwardedAuth } from "./auth-layer.ts";

import type { Application } from "@repo/config";
import type * as Layer from "effect/Layer";
import type { Rpc } from "effect/unstable/rpc";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CoreBindings } from "./bindings.ts";

const entrypointClass = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  audience: Application,
  handlerLayer: (
    bindings: CoreBindings,
  ) => Layer.Layer<Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs>, never>,
): new (ctx: ExecutionContext, env: CoreBindings) => WorkerEntrypoint<CoreBindings> =>
  class extends WorkerEntrypoint<CoreBindings> {
    public override fetch(httpRequest: Request): Promise<Response> {
      if (isAuthForwardPath(new URL(httpRequest.url).pathname)) {
        return Effect.runPromise(handleForwardedAuth(this.env, audience, httpRequest));
      }
      const rpc = createRpcFetcher(rpcContract, handlerLayer(this.env));
      return Effect.runPromise(
        Effect.gen(function* serveRpc() {
          const rpcResponse = yield* Effect.promise(() => rpc.fetch(httpRequest));
          const rpcBytes = yield* Effect.promise(() => rpcResponse.arrayBuffer());
          yield* Effect.promise(() => rpc.dispose());
          return new Response(rpcBytes, {
            headers: rpcResponse.headers,
            status: rpcResponse.status,
          });
        }),
      );
    }
  };

export { entrypointClass };
