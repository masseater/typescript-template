import { NodeSocketServer } from "@effect/platform-node";
import { Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";

const loopback = "127.0.0.1";

const freePort = (): Effect.Effect<number, JourneyFailure> =>
  Effect.scoped(
    NodeSocketServer.make({ host: loopback, port: 0 }).pipe(
      Effect.mapError((cause) => failed("E2E_PORT_UNAVAILABLE", cause)),
      Effect.flatMap((probe) =>
        probe.address._tag === "UnixPathAddress"
          ? Effect.fail(failed("E2E_PORT_UNAVAILABLE"))
          : Effect.succeed(probe.address.port),
      ),
    ),
  );

const loopbackOrigin = (port: number): string => `http://${loopback}:${port}`;

const browserOrigin = (port: number): string => `http://localhost:${port}`;

export { browserOrigin, freePort, loopback, loopbackOrigin };
