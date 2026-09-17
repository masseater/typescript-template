import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { explorerOrigin, requestTelemetry, structuredMessage } from "./explorer.ts";

it.effect("Local Explorer queries only target loopback HTTP app origins", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      (yield* explorerOrigin("http://127.0.0.1:3001/")).href,
      "http://127.0.0.1:3001/",
    );
    for (const app of [
      "https://127.0.0.1:3001/",
      "http://mac-mini.tail2ee823.ts.net:3001/",
      "http://user:secret@127.0.0.1:3001/",
      "http://127.0.0.1:3001/cdn-cgi/local/explorer",
    ]) {
      const failure = yield* explorerOrigin(app).pipe(Effect.flip);
      assert.strictEqual(failure.reason, "origin_invalid");
    }
  }),
);

it("structured console lines are decoded from the Local Explorer message encoding", () => {
  const line = JSON.stringify({ event: "application.error", request_id: "x" });
  assert.deepStrictEqual(structuredMessage(JSON.stringify([line])), {
    event: "application.error",
    request_id: "x",
  });
  assert.isUndefined(structuredMessage(JSON.stringify(["GET http://localhost/"])));
  assert.isUndefined(structuredMessage(42));
});

it.effect("request lookups refuse identifiers that could widen the message match", () =>
  Effect.gen(function* () {
    const failure = yield* requestTelemetry("http://127.0.0.1:3001/", "%").pipe(Effect.flip);
    assert.strictEqual(failure.reason, "request_id_invalid");
  }),
);
