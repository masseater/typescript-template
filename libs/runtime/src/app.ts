import type { Audience } from "@template/db";
import type { CurrentRequest } from "@template/observability";
import { Effect, ManagedRuntime } from "effect";
import type { AnyElysia } from "elysia";
import { Assets, secureResponse } from "./http.ts";
import { appLayer } from "./index.ts";
import type { AppServices } from "./index.ts";
import { requestPath, serveWorker } from "./worker.ts";

type StartHandler = { fetch(request: Request): Promise<Response> | Response };

export function createAppWorker(options: {
  readonly env: unknown;
  readonly audience: Exclude<Audience, "wiki">;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
  readonly api: AnyElysia;
  readonly dispatch: (
    app: AnyElysia,
    request: Request,
  ) => Effect.Effect<Response, never, AppServices | CurrentRequest>;
}) {
  const runtime = ManagedRuntime.make(appLayer(options.env, options.audience, options.routes));
  const route = (request: Request) => {
    const path = requestPath(request);
    if (path === undefined) return Effect.succeed(new Response(null, { status: 400 }));
    if (path.endsWith(".map")) return Effect.succeed(new Response(null, { status: 404 }));
    if (path.startsWith("/assets/"))
      return Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
    if (path.startsWith("/api/")) return options.dispatch(options.api, request);
    return Effect.promise(async () => secureResponse(await options.handler.fetch(request)));
  };
  return serveWorker(runtime, route);
}
