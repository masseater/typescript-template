import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as EffectHttp from "effect/unstable/http/HttpEffect";
import { RpcSerialization, RpcServer, type Rpc } from "effect/unstable/rpc";

import type * as Scope from "effect/Scope";
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";

type RpcServices<Rpcs extends Rpc.Any> =
  | Rpc.Middleware<Rpcs>
  | Rpc.ServicesServer<Rpcs>
  | Rpc.ToHandler<Rpcs>;

const createRpcFetcher = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  handlerLayer: Layer.Layer<RpcServices<Rpcs>>,
  ...handlerLayers: readonly Layer.Layer<RpcServices<Rpcs>>[]
): {
  readonly dispose: () => Promise<void>;
  readonly fetch: (httpRequest: Request) => Promise<Response>;
} => {
  const providedLayer = Layer.mergeAll(handlerLayer, ...handlerLayers, RpcSerialization.layerJson);
  const { dispose, handler } = EffectHttp.toWebHandlerLayer<
    never,
    HttpServerRequest.HttpServerRequest | RpcSerialization.RpcSerialization | RpcServices<Rpcs> | Scope.Scope,
    RpcSerialization.RpcSerialization | RpcServices<Rpcs>,
    never,
    never
  >(
    Effect.gen(function* program() {
      const httpApp = yield* RpcServer.toHttpEffect(rpcContract);
      return yield* httpApp;
    }),
    providedLayer,
  );
  return {
    dispose,
    fetch: (httpRequest: Request): Promise<Response> => handler(httpRequest),
  };
};

export { createRpcFetcher };
