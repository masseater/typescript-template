import { readCore } from "@repo/config";
import { InternalRpcs, makeRpcClient } from "@repo/core-api";
import { Context, Effect, Layer } from "effect";

import type { ConfigurationInvalid, ServiceFetcher } from "@repo/config";
import type { RpcClient, RpcGroup } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";

class CoreRecords extends Context.Service<
  CoreRecords,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof InternalRpcs>, RpcClientError>
>()("#shared/transcription/CoreRecords") {
  public static layer(core: ServiceFetcher): Layer.Layer<CoreRecords> {
    return Layer.effect(CoreRecords, makeRpcClient(InternalRpcs, core));
  }

  public static fromEnvironment(env: unknown): Layer.Layer<CoreRecords, ConfigurationInvalid> {
    return Layer.unwrap(Effect.map(readCore(env), (core) => CoreRecords.layer(core)));
  }
}

export { CoreRecords };
