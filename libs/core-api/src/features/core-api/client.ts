import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization, type Rpc } from "effect/unstable/rpc";

import type * as Scope from "effect/Scope";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const coreRpcUrl = "http://core";

const bindingFetch = (core: Fetcher): typeof fetch => core.fetch.bind(core);

const coreProtocol = (core: Fetcher): Layer.Layer<RpcClient.Protocol> =>
  RpcClient.layerProtocolHttp({ url: coreRpcUrl }).pipe(
    Layer.provide(RpcSerialization.layerJson),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, bindingFetch(core))),
  );

const makeCoreClient = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  core: Fetcher,
): Effect.Effect<
  RpcClient.RpcClient<Rpcs, RpcClientError>,
  never,
  Scope.Scope | Rpc.MiddlewareClient<Rpcs>
> => RpcClient.make(rpcContract).pipe(Effect.provide(coreProtocol(core)));

export { makeCoreClient };
