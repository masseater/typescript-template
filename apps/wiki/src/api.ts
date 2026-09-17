import { handleAuthRequest, verifySession } from "@template/auth";
import { Telemetry, ingestBrowser } from "@template/observability";
import { HealthView, SessionView } from "@template/runtime/contracts";
import { apiBridge, compileApi, createApi, jsonResponse } from "@template/runtime/http";
import type { WikiServices } from "@template/runtime/wiki";
import { Effect } from "effect";
import { searchWiki } from "./lib/search.ts";

const bridge = apiBridge<WikiServices>();
const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

const api = createApi()
  .post("/api/telemetry", bridge.raw(ingestBrowser, {}))
  .get(
    "/api/health",
    bridge.route(
      HealthView,
      () =>
        Telemetry.use((telemetry) =>
          Effect.succeed({ ok: true, service: "wiki", release: telemetry.release } as const),
        ),
      {},
    ),
  )
  .all("/api/auth/*", bridge.raw(handleAuthRequest, unavailable))
  .get(
    "/api/session",
    bridge.route(SessionView, (request) => verifySession(request.headers, true), unavailable),
  )
  .get(
    "/api/search",
    bridge.raw((request) => {
      const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
      return query
        ? searchWiki(query.slice(0, 200)).pipe(Effect.map((results) => jsonResponse(results)))
        : Effect.succeed(jsonResponse([]));
    }, {}),
  );

export const wikiApi = compileApi(api);
export const dispatchWikiApi = bridge.dispatch;
