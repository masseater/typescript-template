import { assert, describe, it } from "@effect/vitest";
import { Deferred, Effect, Layer, ManagedRuntime, Queue, Schema, Stream } from "effect";

import { Telemetry, httpStatus } from "@repo/observability";

import { apiServerClient } from "./client.ts";
import { AppOrigin, apiRoutes, createApi, readSearchParams } from "./http.ts";

const origin = "http://localhost:3001";
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "user" });
const context = Layer.succeed(AppOrigin, origin).pipe(Layer.provideMerge(telemetry));
const runtime = ManagedRuntime.make(context);
const api = apiRoutes(runtime, { service: "user" });

const Tick = Schema.Struct({
  data: Schema.Struct({ count: Schema.NumberFromString }),
  event: Schema.Literal("tick"),
});
const Query = Schema.Struct({ from: Schema.NumberFromString });
const decodeTick = Schema.decodeUnknownEffect(Tick);
const second = 2;

type Ticks = Stream.Stream<typeof Tick.Type>;
type FrameReader = Readonly<Pick<ReadableStreamDefaultReader<unknown>, "cancel" | "read">>;

function tick(count: number): typeof Tick.Type {
  return { data: { count }, event: "tick" };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function open(ticks: Ticks): Effect.Effect<Response> {
  const app = createApi("/api").get(
    "/events",
    api.events(Tick, () => Effect.succeed(ticks), {}),
  );
  return Effect.promise(async () => app.fetch(new Request(`${origin}/api/events`)));
}

function frames(response: Response): FrameReader {
  return (response.body ?? new ReadableStream<Uint8Array>()).getReader();
}

function nextFrame(reader: FrameReader): Effect.Effect<unknown> {
  return Effect.promise(async () => reader.read()).pipe(
    Effect.map(({ value }) =>
      value instanceof Uint8Array ? new TextDecoder().decode(value) : value,
    ),
  );
}

function close(reader: FrameReader): Effect.Effect<void> {
  return Effect.promise(async () => reader.cancel());
}

describe("an event stream route", () => {
  it.effect("sends each value as it happens, encoded by the contract", () =>
    Effect.gen(function* program() {
      const values = yield* Queue.unbounded<typeof Tick.Type>();
      yield* Queue.offer(values, tick(1));
      const reader = frames(yield* open(Stream.fromQueue(values)));
      assert.strictEqual(yield* nextFrame(reader), 'event: tick\ndata: {"count":"1"}\n\n');
      yield* Queue.offer(values, tick(second));
      assert.strictEqual(yield* nextFrame(reader), 'event: tick\ndata: {"count":"2"}\n\n');
      yield* close(reader);
    }),
  );

  it.effect("is never compressed or cached, so a proxy cannot hold frames back", () =>
    Effect.gen(function* program() {
      const response = yield* open(Stream.make(tick(1)));
      const names = ["content-type", "content-encoding", "cache-control"];
      assert.deepStrictEqual(
        names.map((name) => response.headers.get(name)),
        ["text/event-stream", "identity", "no-store"],
      );
      yield* close(frames(response));
    }),
  );

  it.effect("stops the stream when the viewer goes away while nothing is happening", () =>
    Effect.gen(function* program() {
      const released = yield* Deferred.make<boolean>();
      const ticks = Stream.make(tick(1)).pipe(
        Stream.concat(Stream.never),
        Stream.ensuring(Deferred.succeed(released, true)),
      );
      const reader = frames(yield* open(ticks));
      yield* nextFrame(reader);
      yield* close(reader);
      assert.isTrue(yield* Deferred.await(released));
    }),
  );
});

describe("an event stream route seen by its callers", () => {
  it.effect("answers a failure before the stream opens as an ordinary json failure", () =>
    Effect.gen(function* program() {
      const ticks = api.events(
        Tick,
        (request) =>
          readSearchParams(Query, request).pipe(Effect.map(({ from }) => Stream.make(tick(from)))),
        {},
      );
      const app = createApi("/api").get("/events", ticks);
      const request = new Request(`${origin}/api/events`);
      const response = yield* Effect.promise(async () => app.fetch(request));
      const body: unknown = yield* Effect.promise(async () => response.json());
      assert.deepStrictEqual(
        [response.status, body],
        [httpStatus.badRequest, { error: "入力内容を確認してください。" }],
      );
    }),
  );

  it.effect("reaches the typed client as event objects the contract decodes", () =>
    Effect.gen(function* program() {
      const ticks = api.events(Tick, () => Effect.succeed(Stream.make(tick(1), tick(second))), {});
      const client = apiServerClient(createApi("/api").get("/events", ticks), {});
      const reply = yield* Effect.promise(async () => client.api.events.get());
      assert.isNotNull(reply.data);
      const received = Stream.fromAsyncIterable(reply.data, (cause) => cause).pipe(
        Stream.mapEffect((event) => decodeTick(event)),
      );
      assert.deepStrictEqual(yield* Stream.runCollect(received), [tick(1), tick(second)]);
    }),
  );
});
