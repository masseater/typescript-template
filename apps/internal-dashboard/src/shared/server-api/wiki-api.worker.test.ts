import { assert, it } from "@effect/vitest";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { AppOrigin, apiRoutes } from "@repo/runtime/http";
import { referenceCoverage } from "@repo/runtime/reference-coverage";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { wikiRoutes } from "./wiki-api.ts";

const origin = "http://localhost:3003";
const runtime = workerRuntime(() =>
  Layer.succeed(AppOrigin, origin).pipe(
    Layer.provideMerge(
      Telemetry.layer({
        release: "test",
        routes: {},
        serviceName: APPLICATION.wiki,
      }),
    ),
  ),
);

it.effect("the dashboard api reference documents every route the dashboard api serves", () =>
  Effect.gen(function* program() {
    const app = wikiRoutes(apiRoutes(runtime, { service: APPLICATION.wiki }));
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.ok);
    assert.deepStrictEqual(coverage.documented, coverage.served);
    assert.includeMembers([...coverage.documented], ["GET /api/health", "GET /api/session"]);
  }),
);
