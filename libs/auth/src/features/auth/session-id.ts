import { Effect } from "effect";

import { verifySession } from "./session.ts";

const verifiedSessionId = Effect.fn("verifiedSessionId")(function* verifiedSessionId(
  request: Readonly<{ headers: Headers }>,
) {
  const { session } = yield* verifySession(request.headers);
  return session.id;
});

export { verifiedSessionId };
