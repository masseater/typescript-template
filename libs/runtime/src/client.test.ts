import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { httpStatus } from "@template/observability";

import { apiData, apiServerClient } from "./client.ts";
import { compileApi, createApi } from "./http.ts";

const View = Schema.Struct({ id: Schema.String });
const app = compileApi(createApi("/api").get("/view", () => ({ id: "visible" })));

describe("in-process api client", () => {
  it.effect("answers a request without leaving the isolate", () =>
    Effect.gen(function* program() {
      const { api } = yield* Effect.promise(async () => apiServerClient(app, {}));
      const reply = yield* Effect.promise(async () => api.view.get());
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.deepStrictEqual(apiData(View, reply), { id: "visible" });
    }),
  );
});
