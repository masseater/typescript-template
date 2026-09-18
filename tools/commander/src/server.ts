import { NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer, ManagedRuntime, PubSub, Schema, Stream } from "effect";

import type { RequestRejected } from "@repo/observability";
import { httpStatus } from "@repo/observability";
import { AppOrigin, apiRoutes, createApi, jsonResponse, readJsonBody } from "@repo/runtime/http";
import type { Failure, InputInvalid } from "@repo/runtime/http";

import type { BdFailure } from "./bd.ts";
import type { BoardEvent } from "./board.ts";
import { makeBoard } from "./board.ts";
import { makeChat } from "./chat.ts";
import type { ChatEvent } from "./contract.ts";
import { TextInput } from "./contract.ts";
import { bundledAssets, commanderPrompt } from "./prompt.ts";
import { briefing, makeWatch } from "./watch.ts";

interface AppOptions {
  readonly directory: string;
  readonly executable: string;
  readonly model: string | undefined;
  readonly origin: string;
  readonly stateDirectory: string;
}

type ServerEvent = BoardEvent | { readonly data: typeof ChatEvent.Type; readonly event: "chat" };
type Services = AppOrigin | NodeServices.NodeServices;
type BodyFailure = InputInvalid | RequestRejected;
type Reply<Failures> = Effect.Effect<Response, Failures, Services>;

interface Parts {
  readonly board: Effect.Success<ReturnType<typeof makeBoard>>;
  readonly chat: Effect.Success<ReturnType<typeof makeChat>>;
  readonly hub: PubSub.PubSub<ServerEvent>;
}

const Empty = Schema.Struct({});
const commentRoute = new URLPattern({ pathname: "/api/tasks/:id/comments" });
const eventHeaders = { "cache-control": "no-store", "content-type": "text/event-stream" };

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function ledgerFailure(failure: BdFailure): Failure {
  return failure.reason === "rejected"
    ? { message: "見つかりませんでした。", status: httpStatus.notFound }
    : { message: "bd を実行できませんでした。", status: httpStatus.internalServerError };
}

function accepted(): Response {
  return jsonResponse({}, httpStatus.accepted);
}

function done(): Response {
  return jsonResponse({});
}

function reported<Value, Requirements>(
  effect: Effect.Effect<Value, BdFailure, Requirements>,
): Effect.Effect<Value, BdFailure, Requirements> {
  return effect.pipe(
    Effect.tapError((failure) =>
      Console.error(JSON.stringify({ event: "commander.ledger_failed", reason: failure.reason })),
    ),
  );
}

class Handlers {
  private readonly parts: Parts;

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  public constructor(parts: Parts) {
    this.parts = parts;
  }

  public readonly events = (): Reply<never> => {
    const { board, chat, hub } = this.parts;
    const connected = Effect.gen(function* connected() {
      const subscription = yield* PubSub.subscribe(hub);
      yield* board.viewing;
      const { ledger, tasks } = yield* board.state;
      const state = { chat: yield* chat.state, ledger, tasks };
      const updates = Stream.fromSubscription(subscription).pipe(
        Stream.map(({ data, event }) => frame(event, data)),
      );
      return Stream.concat(Stream.make(frame("state", state)), updates);
    });
    return Stream.toReadableStreamEffect(Stream.encodeText(Stream.unwrap(connected))).pipe(
      Effect.map((body) => new Response(body, { headers: eventHeaders })),
    );
  };

  public readonly say = (request: Request): Reply<BodyFailure> =>
    readJsonBody(TextInput, request).pipe(
      Effect.flatMap(({ text }) => this.parts.chat.send(text)),
      Effect.map(accepted),
    );

  public readonly stop = (request: Request): Reply<BodyFailure> =>
    readJsonBody(Empty, request).pipe(Effect.andThen(this.parts.chat.stop), Effect.map(accepted));

  public readonly comment = (request: Request): Reply<BdFailure | BodyFailure> => {
    const id = commentRoute.exec(request.url)?.pathname.groups["id"] ?? "";
    return readJsonBody(TextInput, request).pipe(
      Effect.flatMap(({ text }) => reported(this.parts.board.comment(id, text))),
      Effect.map(done),
    );
  };

  public readonly create = (request: Request): Reply<BdFailure | BodyFailure> =>
    readJsonBody(Empty, request).pipe(
      Effect.andThen(reported(this.parts.board.create)),
      Effect.map(done),
    );
}

function turnEnded(event: ServerEvent): boolean {
  return event.event === "chat" && event.data.change.type === "busy" && !event.data.change.busy;
}

function trusted(request: Request, origin: string): boolean {
  const { port } = new URL(origin);
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return host === new URL(origin).host || host === `localhost:${port}`;
}

const makeParts = Effect.fn("makeParts")(function* makeParts(options: AppOptions) {
  const hub = yield* PubSub.unbounded<ServerEvent>();
  const changes = yield* PubSub.subscribe(hub);
  const board = yield* makeBoard(options.directory, (event) => PubSub.publish(hub, event));
  const chat = yield* makeChat({
    briefing: board.state.pipe(Effect.map(({ tasks }) => briefing(tasks))),
    directory: options.directory,
    executable: options.executable,
    model: options.model,
    prompt: yield* commanderPrompt({
      assets: bundledAssets,
      directory: options.directory,
      stateDirectory: options.stateDirectory,
    }),
    publish: (data) => PubSub.publish(hub, { data, event: "chat" }),
    stateDirectory: options.stateDirectory,
  });
  const watch = yield* makeWatch((text) => chat.wake(text));
  const current = board.state.pipe(Effect.flatMap(({ tasks }) => watch(tasks)));
  const settled = board.refresh.pipe(Effect.andThen(current));
  const observed = Stream.fromSubscription(changes).pipe(
    Stream.runForEach((event) => {
      if (event.event === "tasks") {
        return watch(event.data);
      }
      return turnEnded(event) ? settled : Effect.void;
    }),
  );
  yield* Effect.forkScoped(observed);
  return { board, chat, hub } satisfies Parts;
});

const makeApp = Effect.fn("makeApp")(function* makeApp(options: AppOptions) {
  const handlers = new Handlers(yield* makeParts(options));
  const services = Layer.merge(Layer.succeed(AppOrigin, options.origin), NodeServices.layer);
  const runtime = ManagedRuntime.make(services);
  yield* Effect.addFinalizer(() => runtime.disposeEffect);
  const api = apiRoutes(runtime);
  const app = createApi("/api")
    .get("/events", api.raw(handlers.events, {}))
    .post("/chat", api.raw(handlers.say, {}))
    .post("/chat/stop", api.raw(handlers.stop, {}))
    .post("/tasks/:id/comments", api.raw(handlers.comment, { BdFailure: ledgerFailure }))
    .post("/ledger", api.raw(handlers.create, { BdFailure: ledgerFailure }));
  return {
    fetch: async (request: Request): Promise<Response> =>
      trusted(request, options.origin)
        ? app.fetch(request)
        : jsonResponse({ error: "このアドレスからは使えません。" }, httpStatus.forbidden),
  };
});

export { makeApp };
