import { NodeHttpServer } from "@effect/platform-node";
import { mailpitSendPath } from "@repo/config";
import { Context, Effect, Exit, Layer, Ref, Scope } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { failed, type JourneyFailure } from "./journey-failure.ts";
import { loopbackOrigin } from "./ports.ts";
import { deadlineIn, until } from "./waiting.ts";

import type { NetAddress } from "effect/unstable/net";

const requestPath = (url: string): string => {
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  return path.split("?")[0] ?? path;
};

const accepted = 202;

const notFound = 404;

const recordDelivery = (
  deliveries: Ref.Ref<readonly string[]>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  JourneyFailure,
  HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* acceptMail() {
    const incoming = yield* HttpServerRequest.HttpServerRequest;
    if (incoming.method !== "POST" || requestPath(incoming.url) !== mailpitSendPath) {
      return HttpServerResponse.text("", { status: notFound });
    }
    const delivered = yield* incoming.text.pipe(
      Effect.mapError((cause) => failed("E2E_MAIL_BODY_UNREADABLE", cause)),
    );
    yield* Ref.update(deliveries, (recordedDeliveries) => [...recordedDeliveries, delivered]);
    return HttpServerResponse.text("{}", { status: accepted });
  });

const findLink = (search: {
  readonly deliveries: readonly string[];
  readonly prefix: string;
  readonly recipient: string;
}): readonly string[] => {
  const linkPattern = /https?:\/\/[^\s"'<>\\]+/gu;
  return search.deliveries
    .filter((delivery) => delivery.includes(search.recipient))
    .flatMap((delivery) => [...delivery.matchAll(linkPattern)].map(([link]) => link))
    .filter((link) => link.startsWith(search.prefix));
};

const nextLink = (search: {
  readonly deliveries: Ref.Ref<readonly string[]>;
  readonly prefix: string;
  readonly recipient: string;
}): Effect.Effect<string | undefined> =>
  Ref.get(search.deliveries).pipe(
    Effect.map((recordedDeliveries) =>
      findLink({
        deliveries: recordedDeliveries,
        prefix: search.prefix,
        recipient: search.recipient,
      }).at(0),
    ),
  );

const linkArrives = (search: {
  readonly deliveries: Ref.Ref<readonly string[]>;
  readonly prefix: string;
  readonly recipient: string;
}): Effect.Effect<string, JourneyFailure> => {
  const deliveryTimeout = 60_000;
  return until({
    attempt: () => nextLink(search),
    deadline: deadlineIn(deliveryTimeout),
    reason: "E2E_VERIFICATION_MAIL_NOT_DELIVERED",
  });
};

type MailSink = {
  readonly origin: string;
  readonly stop: Effect.Effect<void, JourneyFailure>;
  readonly waitForLink: (
    recipient: string,
    prefix: string,
  ) => Effect.Effect<string, JourneyFailure>;
};

const sinkOn = (opened: {
  readonly deliveries: Ref.Ref<readonly string[]>;
  readonly port: number;
  readonly stop: Effect.Effect<void, JourneyFailure>;
}): MailSink => ({
  origin: loopbackOrigin(opened.port),
  stop: opened.stop,
  waitForLink: (recipient: string, prefix: string) =>
    linkArrives({ deliveries: opened.deliveries, prefix, recipient }),
});

const listeningPort = (address: NetAddress.SocketAddress): Effect.Effect<number, JourneyFailure> =>
  address._tag === "UnixPathAddress"
    ? Effect.fail(failed("E2E_MAIL_SINK_UNAVAILABLE"))
    : Effect.succeed(address.port);

const startMailSink = (): Effect.Effect<MailSink, JourneyFailure> =>
  Effect.gen(function* openMailSink() {
    const scope = yield* Scope.make();
    const built = yield* Layer.build(NodeHttpServer.layerTest).pipe(
      Scope.provide(scope),
      Effect.mapError((cause) => failed("E2E_MAIL_SINK_UNAVAILABLE", cause)),
    );
    const server = Context.get(built, HttpServer.HttpServer);
    const deliveries = yield* Ref.make<readonly string[]>([]);
    yield* server.serve(recordDelivery(deliveries)).pipe(Scope.provide(scope));
    const port = yield* listeningPort(server.address);
    return sinkOn({
      deliveries,
      port,
      stop: Scope.close(scope, Exit.succeed(undefined)).pipe(
        Effect.mapError((cause) => failed("E2E_MAIL_SINK_NOT_STOPPED", cause)),
      ),
    });
  });

export { startMailSink };
export type { MailSink };
