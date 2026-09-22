import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";

import { Effect, Schema } from "effect";

import { apiData, apiServerClient } from "./client.ts";
import { createApi } from "./http.ts";

const View = Schema.Struct({ id: Schema.String });
const app = createApi("/api").get("/view", () => ({ id: "visible" }));

describe("in-process api client", () => {
  it.effect("answers a request without leaving the isolate", () =>
    Effect.gen(function* program() {
      const { api } = apiServerClient(app, {});
      const reply = yield* Effect.promise(() => Promise.resolve(api.view.get()));
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.deepStrictEqual(apiData(View, reply), { id: "visible" });
    }),
  );
});
