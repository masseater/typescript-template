import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { localUserInbox, readRealtime, realtimeSocketUrl, userInboxClassName } from "./realtime.ts";

it.effect("builds a websocket URL from the application origin", () =>
  Effect.sync(() => {
    assert.strictEqual(
      realtimeSocketUrl("https://app.example.test"),
      "wss://app.example.test/api/realtime",
    );
    assert.strictEqual(
      realtimeSocketUrl("http://localhost:3001"),
      "ws://localhost:3001/api/realtime",
    );
  }),
);

it.effect("reads an optional inbox binding from worker env", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(yield* readRealtime({}), { inbox: undefined });
    assert.deepStrictEqual(localUserInbox.class_name, userInboxClassName);
  }),
);
