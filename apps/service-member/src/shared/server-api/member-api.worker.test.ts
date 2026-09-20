import { assert, it } from "@effect/vitest";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { AppOrigin, apiRoutes } from "@repo/runtime/http";
import { referenceCoverage } from "@repo/runtime/reference-coverage";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { memberRoutes } from "./member-api.ts";

const origin = "http://localhost:3001";
const runtime = workerRuntime(() =>
  Layer.succeed(AppOrigin, origin).pipe(
    Layer.provideMerge(
      Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.user }),
    ),
  ),
);

it.effect("the member api reference documents every route the member api serves", () =>
  Effect.gen(function* program() {
    const app = memberRoutes(apiRoutes(runtime, { service: APPLICATION.user }));
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.ok);
    assert.deepStrictEqual(coverage.documented, coverage.served);
    assert.includeMembers(
      [...coverage.documented],
      ["GET /api/profile", "PATCH /api/profile", "POST /api/interview/turns"],
    );
  }),
);
