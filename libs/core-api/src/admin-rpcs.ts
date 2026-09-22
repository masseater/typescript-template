import { RpcGroup } from "effect/unstable/rpc";

import { AccountRpcs, InviteRpcs } from "./account-rpcs.ts";
import { ready } from "./ready-rpc.ts";
import { SessionRpcs } from "./session-rpcs.ts";

export class AdminRpcs extends RpcGroup.make(ready)
  .merge(SessionRpcs)
  .merge(AccountRpcs)
  .merge(InviteRpcs) {}
