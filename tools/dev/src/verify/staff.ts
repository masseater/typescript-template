import { Effect } from "effect";

import { failure } from "../failure.ts";

import type { ResolvedVerifyEnvironment } from "./environments.ts";

const verifyStaff = Effect.fn("verifyStaff")(function* verifyStaff(
  _resolved: ResolvedVerifyEnvironment,
) {
  return yield* failure("command_unsupported");
});

export { verifyStaff };
