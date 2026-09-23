import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { explorerOrigin, requestTelemetry, withEvent } from "./explorer.ts";

const loopbackApp = "http://127.0.0.1:3001/";
const unrelatedMessage = 42;

it.effect("Local Explorer queries only target loopback HTTP app origins", () =>
  Effect.gen(function* program() {
    assert.strictEqual((yield* explorerOrigin(loopbackApp)).href, loopbackApp);
    for (const app of [
      "https://127.0.0.1:3001/",
      "http://app.example.ts.net:3001/",
      "http://user:secret@127.0.0.1:3001/",
      "http://127.0.0.1:3001/cdn-cgi/local/explorer",
    ]) {
      const failure = yield* explorerOrigin(app).pipe(Effect.flip);
      assert.strictEqual(failure.reason, "origin_invalid");
    }
  }),
);

it.effect("structured console lines are decoded from the Local Explorer message encoding", () =>
  Effect.gen(function* program() {
    const line = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
      event: "application.error",
      request_id: "x",
    });
    const encodedLine = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([line]);
    assert.deepStrictEqual(withEvent({ message: encodedLine, trace_id: "t" }), {
      event: { event: "application.error", request_id: "x" },
      trace_id: "t",
    });
    const getLine = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
      "GET http://localhost/",
    ]);
    assert.strictEqual(withEvent({ message: getLine }).event, "unparsable");
    assert.isUndefined(withEvent({ message: unrelatedMessage }).event);
    assert.strictEqual(withEvent({ message: "{not-json" }).event, "unparsable");
  }),
);

it.effect("request lookups refuse identifiers that could widen the message match", () =>
  Effect.gen(function* program() {
    const failure = yield* requestTelemetry(loopbackApp, "%").pipe(Effect.flip);
    assert.strictEqual(failure.reason, "request_id_invalid");
  }),
);
