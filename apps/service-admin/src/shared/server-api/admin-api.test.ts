import { assert, it } from "@effect/vitest";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { AppOrigin, apiRoutes } from "@repo/runtime/http";
import { referenceCoverage } from "@repo/runtime/reference-coverage";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { adminRoutes } from "./admin-api.ts";

const origin = "http://localhost:3002";
const runtime = workerRuntime(() =>
  Layer.succeed(AppOrigin, origin).pipe(
    Layer.provideMerge(
      Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.admin }),
    ),
  ),
);
const api = apiRoutes(runtime, { service: APPLICATION.admin });

it.effect("the admin api reference is served only to an admin session", () =>
  Effect.gen(function* program() {
    const app = adminRoutes(api);
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.unauthorized);
    assert.deepStrictEqual(coverage.documented, []);
    assert.includeMembers(
      [...coverage.served],
      ["GET /api/users", "PATCH /api/users", "DELETE /api/users"],
    );
  }),
);
