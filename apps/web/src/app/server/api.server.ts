import { env } from "cloudflare:workers";
import { Effect, Option, pipe } from "effect";

import { todoRoutes } from "#/pages/home/index.server";
import { createRouter } from "#/shared/api/index.server";
import { auth } from "#/shared/auth/index.server";

const TOO_MANY_REQUESTS = 429;

const rejectOverLimit = (request: Request): Promise<Response | undefined> =>
  Effect.runPromise(
    Effect.promise(() =>
      env.API_RATE_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" }),
    ).pipe(
      Effect.map(({ success }) =>
        pipe(
          Option.some(new Response("Too Many Requests", { status: TOO_MANY_REQUESTS })),
          Option.filter(() => !success),
          Option.getOrUndefined,
        ),
      ),
    ),
  );

export const api = createRouter("")
  .onRequest(({ request }) => rejectOverLimit(request))
  .mount(auth.handler)
  .use(todoRoutes);
