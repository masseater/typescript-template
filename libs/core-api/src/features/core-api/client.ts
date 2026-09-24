import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization, type Rpc } from "effect/unstable/rpc";

import type * as Scope from "effect/Scope";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const rpcUrl = "http://rpc";

type BindingFetcher = { readonly fetch: typeof fetch };

const bindingFetch = (core: BindingFetcher): typeof fetch => core.fetch.bind(core);

const bindingProtocol = (core: BindingFetcher): Layer.Layer<RpcClient.Protocol> =>
  RpcClient.layerProtocolHttp({ url: rpcUrl }).pipe(
    Layer.provide(RpcSerialization.layerJson),
    Layer.provide(Layer.fresh(FetchHttpClient.layer)),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, bindingFetch(core))),
  );

const makeRpcClient = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  core: BindingFetcher,
): Effect.Effect<
  RpcClient.RpcClient<Rpcs, RpcClientError>,
  never,
  Scope.Scope | Rpc.MiddlewareClient<Rpcs>
> => RpcClient.make(rpcContract).pipe(Effect.provide(bindingProtocol(core)));

export { makeRpcClient };
export type { BindingFetcher };
