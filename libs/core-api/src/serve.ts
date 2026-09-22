import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as EffectHttp from "effect/unstable/http/HttpEffect";
import { RpcSerialization, RpcServer, type Rpc } from "effect/unstable/rpc";

import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const createRpcFetcher = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  handlerLayer: Layer.Layer<Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs>, never, never>,
  ...handlerLayers: readonly Layer.Layer<
    Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs>,
    never,
    never
  >[]
): {
  readonly dispose: () => Promise<void>;
  readonly fetch: (httpRequest: Request) => Promise<Response>;
} => {
  const providedLayer = Layer.mergeAll(handlerLayer, ...handlerLayers, RpcSerialization.layerJson);
  const { dispose, handler } = EffectHttp.toWebHandlerLayer(
    Effect.gen(function* program() {
      const httpApp = yield* RpcServer.toHttpEffect(rpcContract);
      return yield* httpApp;
    }),
    providedLayer,
  );
  return {
    dispose,
    fetch: (httpRequest: Request): Promise<Response> =>
      handler(httpRequest, Context.empty() as never),
  };
};

export { createRpcFetcher };
