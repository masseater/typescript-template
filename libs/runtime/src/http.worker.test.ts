import { httpStatus } from "@repo/config";
import { Effect, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { apiRoot, createApi, elysiaServer } from "./http.ts";

describe("worker api", () => {
  const it = test
    .extend("codeGeneration", () => {
      const generateCode: (source: string) => unknown = globalThis.Function;
      return Result.try(() => generateCode("return 1"));
    })
    .extend("probeAnswer", () =>
      Effect.runPromise(
        Effect.gen(function* probeAnswerProgram() {
          const { ANY: serveRequest } = elysiaServer(
            createApi(apiRoot).get("/probe", () => ({ probed: true })),
          ).handlers;
          const answered = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`http://worker.test${apiRoot}/probe`) }),
          );
          const answerBody: unknown = yield* Effect.promise(() => answered.json());
          return {
            body: answerBody,
            headers: Object.fromEntries(answered.headers),
            status: answered.status,
          };
        }),
      ),
    )
    .extend("absentRouteAnswer", () =>
      Effect.runPromise(
        Effect.gen(function* absentRouteAnswerProgram() {
          const { ANY: serveRequest } = elysiaServer(
            createApi(apiRoot).get("/probe", () => ({ probed: true })),
          ).handlers;
          const answered = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`http://worker.test${apiRoot}/absent`) }),
          );
          const answerBody: unknown = yield* Effect.promise(() => answered.json());
          return {
            body: answerBody,
            headers: Object.fromEntries(answered.headers),
            status: answered.status,
          };
        }),
      ),
    );

  it("evaluates where code generation from strings is refused", ({ codeGeneration }) => {
    expect(codeGeneration).toStrictEqual(
      Result.fail(new EvalError("Code generation from strings disallowed for this context")),
    );
  });

  it("answers a route", ({ probeAnswer }) => {
    expect(probeAnswer).toStrictEqual({
      body: { probed: true },
      headers: { "content-type": "application/json" },
      status: httpStatus.ok,
    });
  });

  it("answers an unknown route", ({ absentRouteAnswer }) => {
    expect(absentRouteAnswer).toStrictEqual({
      body: { error: "見つかりませんでした。" },
      headers: { "content-type": "application/json" },
      status: httpStatus.notFound,
    });
  });
});
