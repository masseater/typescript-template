import { Cause, Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { connect, createServer } from "node:net";
import { NodeRuntime } from "@effect/platform-node";
import type { Scope } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import type { Server } from "node:net";

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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      const server = createServer((client) => {
        const upstream = connect(target, "127.0.0.1");
        client.pipe(upstream).pipe(client);
        // oxlint-disable-next-line typescript/strict-void-return
        client.on("error", () => upstream.destroy());
        // oxlint-disable-next-line typescript/strict-void-return
        upstream.on("error", () => client.destroy());
      });
      server.once("error", () => {
        resume(Effect.fail(new GatewayFailure({ reason: "listen_failed" })));
      });
      server.listen({ host: "::", port: 443 }, () => {
        resume(Effect.succeed(server));
      });
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (server) => Effect.sync(() => server.close()),
  );
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const target = yield* Schema.decodeUnknownEffect(ProxyPort)(Number(process.argv[2])).pipe(
      Effect.mapError(() => new GatewayFailure({ reason: "proxy_port_invalid" })),
    );
    yield* listen(target);
    // oxlint-disable-next-line no-console
    console.info(JSON.stringify({ event: "local.gateway_listening", port: 443, target }));
    return yield* Effect.never;
  }).pipe(
    Effect.scoped,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.sync(() => {
            // oxlint-disable-next-line no-console
            console.error(JSON.stringify({ event: "local.gateway_failed" }));
            process.exitCode = 1;
          }),
    ),
  ),
  { disableErrorReporting: true },
);
