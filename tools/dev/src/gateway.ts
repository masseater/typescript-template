// oxlint-disable-next-line import/no-nodejs-modules
import { connect, createServer } from "node:net";

import { causeRecord, runCli } from "@repo/cli";
import { loopbackAddress } from "@repo/config";
import { Console, Effect, Schema } from "effect";

// oxlint-disable-next-line import/no-nodejs-modules
import type { Server } from "node:net";
import type { Scope } from "effect";

class GatewayFailure extends Schema.TaggedError<GatewayFailure>()("GatewayFailure", {
  reason: Schema.Literals(["proxy_port_invalid", "listen_failed"]),
}) {}

const HIGHEST_PRIVILEGED_PORT = 1024;
const ProxyPort = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(HIGHEST_PRIVILEGED_PORT),
);

function listen(target: number): Effect.Effect<Server, GatewayFailure, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.callback<ReturnType<typeof createServer>, GatewayFailure>((resume) => {
      const server = createServer((client) => {
        const upstream = connect(target, loopbackAddress);
        client.pipe(upstream).pipe(client);
        client.on("error", () => {
          upstream.destroy();
        });
        upstream.on("error", () => {
          client.destroy();
        });
      });
      server.once("error", () => {
        resume(Effect.fail(new GatewayFailure({ reason: "listen_failed" })));
      });
      server.listen({ host: "::", port: 443 }, () => {
        resume(Effect.succeed(server));
      });
    }),
    (server) => Effect.sync(() => server.close()),
  );
}

runCli(
  Effect.gen(function* program() {
    const target = yield* Schema.decodeUnknownEffect(ProxyPort)(Number(process.argv[2])).pipe(
      Effect.mapError(() => new GatewayFailure({ reason: "proxy_port_invalid" })),
    );
    yield* listen(target);
    yield* Console.info(JSON.stringify({ event: "local.gateway_listening", port: 443, target }));
    return yield* Effect.never;
  }).pipe(Effect.scoped),
  (cause) => causeRecord("local.gateway_failed", cause),
);
