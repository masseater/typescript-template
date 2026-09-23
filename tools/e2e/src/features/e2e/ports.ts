import { once } from "node:events";
import { createServer } from "node:net";

import { Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";

const loopback = "127.0.0.1";

const freePort = (): Effect.Effect<number, JourneyFailure> =>
  Effect.gen(function* reserveLoopbackPort() {
    const probe = createServer();
    probe.listen(0, loopback);
    yield* Effect.tryPromise({
      try: () => once(probe, "listening"),
      catch: (cause) => failed("E2E_PORT_UNAVAILABLE", cause),
    });
    const address = probe.address();
    probe.close();
    yield* Effect.tryPromise({
      try: () => once(probe, "close"),
      catch: (cause) => failed("E2E_PORT_UNAVAILABLE", cause),
    });
    if (typeof address !== "object" || address === null) {
      return yield* failed("E2E_PORT_UNAVAILABLE");
    }
    return address.port;
  });

const loopbackOrigin = (port: number): string => `http://${loopback}:${port}`;

export { freePort, loopback, loopbackOrigin };
