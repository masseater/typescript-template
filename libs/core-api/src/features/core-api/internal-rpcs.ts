import { RpcGroup } from "effect/unstable/rpc";

import { ready } from "./ready-rpc.ts";
import { recordingRpcs } from "./recording-rpcs.ts";

export class InternalRpcs extends RpcGroup.make(ready, ...recordingRpcs) {}
