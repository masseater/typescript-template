import { RpcGroup } from "effect/unstable/rpc";

import { ready } from "./ready-rpc.ts";

export class InternalRpcs extends RpcGroup.make(ready) {}
