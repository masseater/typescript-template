import { RpcGroup } from "effect/unstable/rpc";

import { ready } from "./ready-rpc.ts";

export class AdminRpcs extends RpcGroup.make(ready) {}
