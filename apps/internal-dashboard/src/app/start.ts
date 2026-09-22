import { httpStatus } from "@repo/config";

import { jsonResponse } from "@repo/runtime/http";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { Effect, Option } from "effect";

import { guardAccess, runtime } from "#shared/server-api/index.ts";

const guard = createMiddleware().server(({ next, request }) =>
  runtime.runPromise(
    Effect.gen(function* guardRequest() {
      const result = yield* Effect.result(guardAccess(request, new URL(request.url).pathname));
      if (result._tag === "Failure") {
        return jsonResponse({ error: "処理に失敗しました。" }, httpStatus.internalServerError);
      }
      if (Option.isSome(result.success)) {
        return result.success.value;
      }
      return yield* Effect.promise(() => Promise.resolve(next()));
    }),
  ),
);

const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const startInstance = createStart(() => ({ requestMiddleware: [csrf, guard] }));

export { startInstance };
