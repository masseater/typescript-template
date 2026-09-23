import { DatabaseFailure } from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

const databaseReady = Rpc.make("databaseReady", {
  error: DatabaseFailure,
  payload: {},
  success: Schema.Boolean,
});

export class MemberRpcs extends RpcGroup.make(databaseReady) {}
