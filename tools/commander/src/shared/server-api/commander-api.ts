import { httpStatus, ingestBrowser } from "@repo/observability";
import { AppOrigin, apiRoot, apiRoutes, createApi, failureBy } from "@repo/runtime/http";
import { Effect, PubSub, Schema, Stream } from "effect";

import { Done, NoInput, ServerEvent, TextInput } from "#shared/contract/index.ts";
import { Commander } from "./commander.ts";

import type { NodeServices } from "@effect/platform-node";
import type { Reporting, Telemetry } from "@repo/observability";
import type { ApiRoutes } from "@repo/runtime/http";
import type { WorkerRuntime } from "@repo/runtime/worker";
import type { BdFailure } from "./bd.ts";

type Services = AppOrigin | Commander | NodeServices.NodeServices | Telemetry;
type Published = typeof ServerEvent.Type;

class HostRejected extends Schema.TaggedError<HostRejected>()("HostRejected", {}) {}

const commentRoute = new URLPattern({ pathname: `${apiRoot}/tasks/:id/comments` });
const done = {};
const rejected = {
  HostRejected: { message: "このアドレスからは使えません。", status: httpStatus.forbidden },
};
const failures = {
  ...rejected,
  BdFailure: failureBy(
    [httpStatus.notFound, httpStatus.internalServerError],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (failure: BdFailure) =>
      failure.reason === "rejected"
        ? { message: "見つかりませんでした。", status: httpStatus.notFound }
        : { message: "bd を実行できませんでした。", status: httpStatus.internalServerError },
  ),
};

const trustedHost = Effect.fn("commander.api.trustedHost")(function* trustedHost(request: Request) {
  const { host, port } = new URL(yield* AppOrigin);
  const asked = request.headers.get("host") ?? new URL(request.url).host;
  if (asked !== host && asked !== `localhost:${port}`) {
    return yield* new HostRejected();
  }
  return asked;
});

const connected = Effect.gen(function* connected() {
  const { board, chat, hub } = yield* Commander;
  const subscription = yield* PubSub.subscribe(hub);
  yield* board.viewing;
  const { ledger, tasks } = yield* board.state;
  const seen = { chat: yield* chat.state, ledger };
  const first: Published = {
    data: tasks === undefined ? seen : { ...seen, tasks },
    event: "state",
  };
  return Stream.concat(Stream.make(first), Stream.fromSubscription(subscription));
});

const events = Effect.fn("commander.api.events")(function* events(request: Request) {
  yield* trustedHost(request);
  return Stream.unwrap(connected);
});

const say = Effect.fn("commander.api.say")(function* say(
  request: Request,
  { text }: typeof TextInput.Type,
) {
  yield* trustedHost(request);
  const { chat } = yield* Commander;
  yield* chat.send(text);
  return done;
});

const stop = Effect.fn("commander.api.stop")(function* stop(request: Request) {
  yield* trustedHost(request);
  const { chat } = yield* Commander;
  yield* chat.stop;
  return done;
});

const comment = Effect.fn("commander.api.comment")(function* comment(
  request: Request,
  { text }: typeof TextInput.Type,
) {
  yield* trustedHost(request);
  const { board } = yield* Commander;
  const id = commentRoute.exec(request.url)?.pathname.groups["id"] ?? "";
  yield* board.comment(id, text);
  return done;
});

const createLedger = Effect.fn("commander.api.createLedger")(function* createLedger(
  request: Request,
) {
  yield* trustedHost(request);
  const { board } = yield* Commander;
  yield* board.create;
  return done;
});

function commanderApi(api: ApiRoutes<Services>) {
  return createApi("")
    .post("/telemetry", ...api.raw(ingestBrowser, {}))
    .get("/events", ...api.events(ServerEvent, events, rejected))
    .post("/chat", ...api.route({ body: TextInput, response: Done }, say, rejected))
    .post("/chat/stop", ...api.route({ body: NoInput, response: Done }, stop, rejected))
    .post(
      "/tasks/:id/comments",
      ...api.route({ body: TextInput, response: Done }, comment, failures),
    )
    .post("/ledger", ...api.route({ body: NoInput, response: Done }, createLedger, failures));
}

function commanderApp(runtime: WorkerRuntime<Services, unknown>, reporting: Reporting) {
  return createApi(apiRoot).use(commanderApi(apiRoutes(runtime, reporting)));
}

export { commanderApp };
export type { Services };
