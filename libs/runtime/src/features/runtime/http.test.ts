import { httpStatus } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { Deferred, Effect, Layer, Queue, Schema, Stream } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { apiServerClient } from "./client.ts";
import {
  AppOrigin,
  apiRoutes,
  createApi,
  elysiaServer,
  readJsonBody,
  readSearchParams,
} from "./http.ts";
import { startRoute, workerRuntime } from "./worker.ts";

const EchoBody = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, 100)),
  profile: Schema.String.check(Schema.isMaxLength(2000)),
  socialLinks: Schema.Array(
    Schema.String.check(
      Schema.isMaxLength(2048),
      Schema.makeFilter(
        (link: string) => URL.parse(link)?.protocol === "https:" || "https URL required",
      ),
    ),
  ).check(Schema.isMaxLength(10)),
});
const Tick = Schema.Struct({
  data: Schema.Struct({ count: Schema.FiniteFromString }),
  event: Schema.Literal("tick"),
});
const TickQuery = Schema.Struct({ from: Schema.FiniteFromString });

const origin = "http://localhost:3001";
const profileLink = "https://profile.example.test/member";
const oversizedBody = 16_385;
const repeatedPrivateText = 10;
const jsonHeaders = { "content-type": "application/json", origin };
const firstTick = { data: { count: 1 }, event: "tick" } as const;
const secondTick = { data: { count: 2 }, event: "tick" } as const;
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "service-member" });
const appContext = Layer.succeed(AppOrigin, origin).pipe(Layer.provideMerge(telemetry));
const runtime = workerRuntime(() => appContext);
const api = apiRoutes(runtime, { service: "service-member" });
const rejections = [
  [
    "origin_denied",
    { ...jsonHeaders, origin: "https://other.example.test" },
    "{}",
    httpStatus.forbidden,
  ],
  [
    "json_required",
    { ...jsonHeaders, "content-type": "text/plain" },
    "{}",
    httpStatus.unsupportedMediaType,
  ],
  ["invalid_json", jsonHeaders, "{", httpStatus.badRequest],
  ["body_too_large", jsonHeaders, "x".repeat(oversizedBody), httpStatus.payloadTooLarge],
] as const;

describe("a bounded same-origin JSON mutation", () => {
  const it = test.extend("decodedMutation", () =>
    Effect.runPromise(
      Effect.gen(function* decodedMutationProgram() {
        const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: " 利用者 ",
          profile: "自己紹介です。",
          socialLinks: [profileLink],
        });
        return yield* readJsonBody(
          EchoBody,
          new Request(`${origin}/api/profile`, {
            body: encoded,
            headers: jsonHeaders,
            method: "PATCH",
          }),
        );
      }).pipe(Effect.provide(appContext)),
    ));

  it("is read through the contract", ({ decodedMutation }) => {
    expect(decodedMutation).toStrictEqual({
      name: "利用者",
      profile: "自己紹介です。",
      socialLinks: [profileLink],
    });
  });
});

describe.for(rejections)(
  "a JSON mutation that fails %s",
  ([reason, mutationHeaders, encoded, rejectedStatus]) => {
    const it = test
      .extend("mutationRejection", () =>
        Effect.runPromise(
          readJsonBody(
            EchoBody,
            new Request(`${origin}/api/profile`, {
              body: encoded,
              headers: mutationHeaders,
              method: "PATCH",
            }),
          ).pipe(
            Effect.flip,
            Effect.map((rejection) => ({
              reason: "reason" in rejection ? rejection.reason : undefined,
              tag: rejection._tag,
            })),
            Effect.provide(appContext),
          ),
        ))
      .extend("rejectedAnswer", () =>
        Effect.runPromise(
          Effect.gen(function* rejectedAnswerProgram() {
            const echo = api.route(EchoBody, (asked) => readJsonBody(EchoBody, asked), {});
            const {
              handlers: { ANY: answerAny },
            } = elysiaServer(createApi("").patch("/api/profile", echo));
            const answered = yield* startRoute({
              fetch: (rendered) => answerAny({ request: rendered }),
            })(
              new Request(`${origin}/api/profile`, {
                body: encoded,
                headers: mutationHeaders,
                method: "PATCH",
              }),
            );
            return answered.status;
          }),
        ),
      );

    it("is rejected for that reason", ({ mutationRejection }) => {
      expect(mutationRejection).toStrictEqual({ reason, tag: "RequestRejected" });
    });

    it("is still rejected behind a start server route that keeps the body readable", ({
      rejectedAnswer,
    }) => {
      expect(rejectedAnswer).toBe(rejectedStatus);
    });
  },
);

describe("a JSON mutation carrying a self-assigned role", () => {
  const it = test.extend("mutationRejection", () =>
    Effect.runPromise(
      Effect.gen(function* mutationRejectionProgram() {
        const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "reader",
          profile: "",
          role: "admin",
          socialLinks: [],
        });
        const rejection = yield* readJsonBody(
          EchoBody,
          new Request(`${origin}/api/profile`, {
            body: encoded,
            headers: jsonHeaders,
            method: "PATCH",
          }),
        ).pipe(Effect.flip);
        return rejection._tag;
      }).pipe(Effect.provide(appContext)),
    ));

  it("is rejected as invalid input", ({ mutationRejection }) => {
    expect(mutationRejection).toBe("InputInvalid");
  });
});

describe("an api route behind a start server route given invalid input", () => {
  const it = test.extend("invalidAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* invalidAnswerProgram() {
        const echo = api.route(EchoBody, (asked) => readJsonBody(EchoBody, asked), {});
        const {
          handlers: { ANY: answerAny },
        } = elysiaServer(createApi("").patch("/api/profile", echo));
        const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "private-profile-text".repeat(repeatedPrivateText),
          profile: 1,
        });
        const answered = yield* startRoute({
          fetch: (rendered) => answerAny({ request: rendered }),
        })(
          new Request(`${origin}/api/profile`, {
            body: encoded,
            headers: jsonHeaders,
            method: "PATCH",
          }),
        );
        const answerText = yield* Effect.promise(() => answered.text());
        return {
          echoesSubmitted: answerText.includes("private-profile-text"),
          error: yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(answerText),
          status: answered.status,
        };
      }),
    ));

  it("returns the validation error without echoing submitted values", ({ invalidAnswer }) => {
    expect(invalidAnswer).toStrictEqual({
      echoesSubmitted: false,
      error: { error: "入力内容を確認してください。" },
      status: httpStatus.badRequest,
    });
  });
});

describe("an event stream route fed as values happen", () => {
  const it = test.extend("tickFrames", () =>
    Effect.runPromise(
      Effect.gen(function* tickFramesProgram() {
        const ticks = yield* Queue.unbounded<typeof Tick.Type>();
        yield* Queue.offer(ticks, firstTick);
        const app = createApi("/api").get(
          "/events",
          api.events(Tick, () => Effect.succeed(Stream.fromQueue(ticks)), {}),
        );
        const opened = yield* Effect.promise(() => app.handle(new Request(`${origin}/api/events`)));
        const frames: ReadableStreamDefaultReader<unknown> = (
          opened.body ?? new ReadableStream<Uint8Array>()
        ).getReader();
        const first = yield* Effect.promise(() => frames.read());
        yield* Queue.offer(ticks, secondTick);
        const second = yield* Effect.promise(() => frames.read());
        yield* Effect.promise(() => frames.cancel());
        return [first.value, second.value].map((frame) =>
          frame instanceof Uint8Array ? new TextDecoder().decode(frame) : frame,
        );
      }),
    ));

  it("sends each value as it happens, encoded by the contract", ({ tickFrames }) => {
    expect(tickFrames).toStrictEqual([
      'event: tick\ndata: {"count":"1"}\n\n',
      'event: tick\ndata: {"count":"2"}\n\n',
    ]);
  });
});

describe("an event stream route's headers", () => {
  const it = test.extend("streamHeaders", () =>
    Effect.runPromise(
      Effect.gen(function* streamHeadersProgram() {
        const app = createApi("/api").get(
          "/events",
          api.events(Tick, () => Effect.succeed(Stream.make(firstTick)), {}),
        );
        const opened = yield* Effect.promise(() => app.handle(new Request(`${origin}/api/events`)));
        yield* Effect.promise(() => opened.body?.cancel() ?? Promise.resolve());
        return ["content-type", "content-encoding", "cache-control"].map((headerName) =>
          opened.headers.get(headerName),
        );
      }),
    ));

  it("is never compressed or cached, so a proxy cannot hold frames back", ({ streamHeaders }) => {
    expect(streamHeaders).toStrictEqual(["text/event-stream", "identity", "no-store"]);
  });
});

describe("an event stream route whose viewer goes away while nothing is happening", () => {
  const it = test.extend("sourceReleased", () =>
    Effect.runPromise(
      Effect.gen(function* sourceReleasedProgram() {
        const released = yield* Deferred.make<boolean>();
        const ticks = Stream.make(firstTick).pipe(
          Stream.concat(Stream.never),
          Stream.ensuring(Deferred.succeed(released, true)),
        );
        const app = createApi("/api").get(
          "/events",
          api.events(Tick, () => Effect.succeed(ticks), {}),
        );
        const opened = yield* Effect.promise(() => app.handle(new Request(`${origin}/api/events`)));
        const frames: ReadableStreamDefaultReader<unknown> = (
          opened.body ?? new ReadableStream<Uint8Array>()
        ).getReader();
        yield* Effect.promise(() => frames.read());
        yield* Effect.promise(() => frames.cancel());
        return yield* Deferred.await(released);
      }),
    ));

  it("stops the stream", ({ sourceReleased }) => {
    expect(sourceReleased).toBe(true);
  });
});

describe("an event stream route whose source dies after it opened", () => {
  const it = test.extend("closingFrames", () =>
    Effect.runPromise(
      Effect.gen(function* closingFramesProgram() {
        const ticks = Stream.make(firstTick).pipe(Stream.concat(Stream.die("source died")));
        const app = createApi("/api").get(
          "/events",
          api.events(Tick, () => Effect.succeed(ticks), {}),
        );
        const opened = yield* Effect.promise(() => app.handle(new Request(`${origin}/api/events`)));
        const frames: ReadableStreamDefaultReader<unknown> = (
          opened.body ?? new ReadableStream<Uint8Array>()
        ).getReader();
        const first = yield* Effect.promise(() => frames.read());
        const failed = yield* Effect.promise(() => frames.read());
        const ended = yield* Effect.promise(() => frames.read());
        return [first.value, failed.value, ended.value].map((frame) =>
          frame instanceof Uint8Array ? new TextDecoder().decode(frame) : frame,
        );
      }),
    ));

  it("ends with a failed event", ({ closingFrames }) => {
    expect(closingFrames).toStrictEqual([
      'event: tick\ndata: {"count":"1"}\n\n',
      `event: failed\ndata: {"message":"処理に失敗しました。リクエスト ID でログを確認してください。","status":${String(httpStatus.internalServerError)}}\n\n`,
      undefined,
    ]);
  });
});

describe("a HEAD request to an event stream route", () => {
  const it = test.extend("headAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* headAnswerProgram() {
        const silentAfterFirst = Stream.make(firstTick).pipe(Stream.concat(Stream.never));
        const ticks = api.events(Tick, () => Effect.succeed(silentAfterFirst), {});
        const {
          handlers: { HEAD: answerHead },
        } = elysiaServer(createApi("/api").get("/events", ticks));
        const answered = yield* Effect.promise(() =>
          answerHead({ request: new Request(`${origin}/api/events`, { method: "HEAD" }) }),
        );
        const answerText = yield* Effect.promise(() => answered.text());
        return [answered.status, answered.headers.get("content-type"), answerText];
      }),
    ));

  it("is answered with the stream's headers without waiting for the stream to end", ({
    headAnswer,
  }) => {
    expect(headAnswer).toStrictEqual([httpStatus.ok, "text/event-stream", ""]);
  });
});

describe("an event stream route that fails before the stream opens", () => {
  const it = test.extend("openingFailure", () =>
    Effect.runPromise(
      Effect.gen(function* openingFailureProgram() {
        const ticks = api.events(
          Tick,
          (asked) =>
            readSearchParams(TickQuery, asked).pipe(
              Effect.map(({ from }) =>
                Stream.make({ data: { count: from }, event: "tick" } as const),
              ),
            ),
          {},
        );
        const app = createApi("/api").get("/events", ticks);
        const answered = yield* Effect.promise(() =>
          app.handle(new Request(`${origin}/api/events`)),
        );
        const failure: unknown = yield* Effect.promise(() => answered.json());
        return [answered.status, failure];
      }),
    ));

  it("is answered as an ordinary json failure", ({ openingFailure }) => {
    expect(openingFailure).toStrictEqual([
      httpStatus.badRequest,
      { error: "入力内容を確認してください。" },
    ]);
  });
});

describe("an event stream route seen by the typed client", () => {
  const it = test.extend("receivedTicks", () =>
    Effect.runPromise(
      Effect.gen(function* receivedTicksProgram() {
        const ticks = api.events(
          Tick,
          () => Effect.succeed(Stream.make(firstTick, secondTick)),
          {},
        );
        const client = apiServerClient(createApi("/api").get("/events", ticks), {});
        const eventReply = yield* Effect.promise(() => client.api.events.get());
        const tickEvents = eventReply.data;
        if (tickEvents === null || !(Symbol.asyncIterator in tickEvents)) {
          return yield* Effect.die(tickEvents);
        }
        return yield* Stream.fromAsyncIterable(tickEvents, (cause) => cause).pipe(
          Stream.orDie,
          Stream.mapEffect((tickEvent) => Schema.decodeUnknownEffect(Tick)(tickEvent)),
          Stream.runCollect,
        );
      }),
    ));

  it("receives event objects the contract decodes", ({ receivedTicks }) => {
    expect(receivedTicks).toStrictEqual([firstTick, secondTick]);
  });
});
