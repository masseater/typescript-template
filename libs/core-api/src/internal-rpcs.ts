import { RpcGroup } from "effect/unstable/rpc";

import { ready } from "./ready-rpc.ts";
import { SessionRpcs } from "./session-rpcs.ts";

export class InternalRpcs extends RpcGroup.make(ready).merge(SessionRpcs) {}
