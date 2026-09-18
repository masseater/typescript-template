import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { httpStatus } from "@template/observability";
import { jsonResponse } from "@template/runtime/http";
import { Exit, Option } from "effect";

import { guardAccess, runtime } from "#shared/server-api/index.ts";

const guard = createMiddleware().server(async ({ next, request }) => {
  const exit = await runtime.runPromiseExit(guardAccess(request, new URL(request.url).pathname));
  if (Exit.isFailure(exit)) {
    return jsonResponse({ error: "処理に失敗しました。" }, httpStatus.internalServerError);
  }
  return Option.isSome(exit.value) ? exit.value.value : next();
});

const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const startInstance = createStart(() => ({ requestMiddleware: [csrf, guard] }));

export { startInstance };
