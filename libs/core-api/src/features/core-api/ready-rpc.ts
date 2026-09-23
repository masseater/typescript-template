import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";

const ready = Rpc.make("ready", {
  payload: {},
  success: Schema.Boolean,
});

export { ready };
