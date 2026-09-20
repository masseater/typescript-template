import { NodeSocket, NodeSocketServer } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { loopbackAddress } from "@repo/config";
import { Console, Effect, Layer, Schema } from "effect";
import { SocketServer } from "effect/unstable/socket/SocketServer";

import type { Scope } from "effect";
import type { Socket, SocketError } from "effect/unstable/socket/Socket";

class GatewayFailure extends Schema.TaggedError<GatewayFailure>()("GatewayFailure", {
  reason: Schema.Literals(["proxy_port_invalid", "listen_failed"]),
}) {}

const HIGHEST_PRIVILEGED_PORT = 1024;
const ProxyPort = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(HIGHEST_PRIVILEGED_PORT),
);

function openUpstream(
  target: number,
): Effect.Effect<Socket.Socket, SocketError, Scope.Scope> {
  return NodeSocket.makeNet({ host: loopbackAddress, port: target }) as Effect.Effect<
    Socket.Socket,
    SocketError,
    Scope.Scope
  >;
}

function proxyConnection(target: number, client: Socket.Socket): Effect.Effect<void, never, never> {
  return (Effect.scoped(
    openUpstream(target).pipe(
      Effect.catch(() => Effect.succeed(undefined)),
      Effect.flatMap((upstream) =>
        upstream === undefined
          ? Effect.void
          : Effect.scoped(
              Effect.gen(function* forward() {
                const writeUpstream = yield* upstream.writer;
                const writeClient = yield* client.writer;
                yield* Effect.all(
                  [
                    client.run((chunk) => writeUpstream(chunk).pipe(Effect.orDie)),
                    upstream.run((chunk) => writeClient(chunk).pipe(Effect.orDie)),
                  ],
                  { concurrency: "unbounded", discard: true },
                ).pipe(Effect.orDie);
              }),
            ),
      ),
      Effect.asVoid,
    ),
  ) as Effect.Effect<void, never, never>);
}

const program = (Effect.gen(function* gateway() {
  const target = yield* Schema.decodeUnknownEffect(ProxyPort)(Number(process.argv[2])).pipe(
    Effect.mapError(() => new GatewayFailure({ reason: "proxy_port_invalid" })),
  );
  const server = yield* SocketServer.SocketServer;
  yield* Console.info(JSON.stringify({ event: "local.gateway_listening", port: 443, target }));
  yield* server.run(
    Effect.fnUntraced(function* handleClient(client: Socket.Socket) {
      yield* proxyConnection(target, client);
    }, Effect.orDie),
  );
}).pipe(
  Effect.scoped,
  Effect.provide(
    NodeSocketServer.layer({ host: "::", port: 443 }).pipe(
      Layer.mapError(() => new GatewayFailure({ reason: "listen_failed" })),
    ),
  ),
) as Effect.Effect<void, GatewayFailure, never>);

runCli(program, (cause) => causeRecord("local.gateway_failed", cause));
