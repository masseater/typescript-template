import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  SessionIdentityMiddleware,
  SessionIdentityView,
  SessionInvalid,
  SessionRequired,
} from "./session-identity.ts";

const getSession = Rpc.make("getSession", {
  error: Schema.Union([SessionRequired, SessionInvalid]),
  payload: {},
  success: SessionIdentityView,
}).middleware(SessionIdentityMiddleware);

export class SessionRpcs extends RpcGroup.make(getSession) {}

export { getSession };
