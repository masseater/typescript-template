import { DatabaseFailure } from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { MemberSessionRpcs } from "./member-session-rpcs.ts";

const databaseReady = Rpc.make("databaseReady", {
  error: DatabaseFailure,
  payload: {},
  success: Schema.Boolean,
});

export class MemberRpcs extends RpcGroup.make(databaseReady).merge(MemberSessionRpcs) {}
