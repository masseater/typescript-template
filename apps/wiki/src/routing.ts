import { Cause, Effect, Option } from "effect";
import { httpStatus, reportFailure } from "@template/observability";
import { jsonResponse, secureResponse } from "@template/runtime/http";
import { guardAccess } from "./lib/access.ts";
import { handleAuthRequest } from "@template/auth";
import handler from "@tanstack/react-start/server-entry";
import { serveMcp } from "./lib/mcp.ts";
import { startRoute } from "@template/runtime/app";

const serveStart = startRoute(handler);

const route = Effect.fn("wikiRoute")(function* route(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  path: string,
) {
  if (path.startsWith("/.well-known/oauth-")) {
    return secureResponse(yield* handleAuthRequest(request));
  }
  if (path === "/mcp") {
    return yield* serveMcp(request);
  }
  const denied = yield* guardAccess(request, path);
  return Option.isSome(denied) ? denied.value : yield* serveStart(request, path);
});

function wikiRoute(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  path: string,
): Effect.Effect<Response, never, Effect.Services<ReturnType<typeof route>>> {
  return route(request, path).pipe(
    Effect.matchEffect({
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      onFailure: (error) =>
        reportFailure(Cause.fail(error)).pipe(
          Effect.as(
            jsonResponse({ error: "処理に失敗しました。" }, httpStatus.internalServerError),
          ),
        ),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      onSuccess: (response) => Effect.succeed(response),
    }),
  );
}

export { wikiRoute };
