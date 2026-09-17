import type { Application } from "@template/config";
import type { CurrentRequest } from "@template/observability";
import { Effect, ManagedRuntime } from "effect";
import type { AnyElysia } from "elysia";
import { secureResponse } from "./http.ts";
import { appLayer } from "./index.ts";
import type { AppServices } from "./index.ts";
import { serveApp } from "./worker.ts";

type StartHandler = { fetch(request: Request): Promise<Response> | Response };

export function createAppWorker(options: {
  readonly env: unknown;
  readonly audience: Exclude<Application, "wiki">;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
  readonly api: AnyElysia;
  readonly dispatch: (
    app: AnyElysia,
    request: Request,
  ) => Effect.Effect<Response, never, AppServices | CurrentRequest>;
}) {
  const runtime = ManagedRuntime.make(appLayer(options.env, options.audience, options.routes));
  return serveApp(runtime, (request, path) =>
    path.startsWith("/api/")
      ? options.dispatch(options.api, request)
      : Effect.promise(async () => secureResponse(await options.handler.fetch(request))),
  );
}
