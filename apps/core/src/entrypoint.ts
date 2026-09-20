import { createRpcFetcher } from "@repo/core-api";
import { WorkerEntrypoint } from "cloudflare:workers";

import type * as Layer from "effect/Layer";
import type { Rpc } from "effect/unstable/rpc";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CoreBindings } from "./bindings.ts";

const entrypointClass = <Rpcs extends Rpc.Any>(
  rpcContract: RpcGroup.RpcGroup<Rpcs>,
  handlerLayer: (bindings: CoreBindings) => Layer.Layer<Rpc.ToHandler<Rpcs>>,
): new (ctx: ExecutionContext, env: CoreBindings) => WorkerEntrypoint<CoreBindings> =>
  class extends WorkerEntrypoint<CoreBindings> {
    public override async fetch(httpRequest: Request): Promise<Response> {
      const rpc = createRpcFetcher(rpcContract, handlerLayer(this.env));
      const rpcResponse = await rpc.fetch(httpRequest);
      const rpcBytes = await rpcResponse.arrayBuffer();
      await rpc.dispose();
      return new Response(rpcBytes, { headers: rpcResponse.headers, status: rpcResponse.status });
    }
  };

export { entrypointClass };
