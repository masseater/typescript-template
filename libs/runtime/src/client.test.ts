import { Effect, Schema } from "effect";
import { apiData, apiServerClient } from "./client.ts";
import { assert, describe, it } from "@effect/vitest";
import { compileApi, createApi } from "./http.ts";
import { httpStatus } from "@repo/observability";

const View = Schema.Struct({ id: Schema.String });
const app = compileApi(createApi("/api").get("/view", () => ({ id: "visible" })));

describe("in-process api client", () => {
  it.effect("resolves when awaited instead of being taken for a thenable", () =>
    Effect.gen(function* program() {
      const client = yield* Effect.promise(async () => apiServerClient(app, {}));
      assert.deepStrictEqual(
        [typeof Reflect.get(client, "then"), typeof Reflect.get(client.api, "then")],
        ["undefined", "function"],
      );
    }),
  );

  it.effect("answers a request without leaving the isolate", () =>
    Effect.gen(function* program() {
      const { api } = yield* Effect.promise(async () => apiServerClient(app, {}));
      const reply = yield* Effect.promise(async () => api.view.get());
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.deepStrictEqual(apiData(View, reply), { id: "visible" });
    }),
  );
});
