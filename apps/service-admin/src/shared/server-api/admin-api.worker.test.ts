import { assert, it } from "@effect/vitest";
import { Auth } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { AppOrigin, apiRoutes } from "@repo/runtime/http";
import { referenceCoverage } from "@repo/runtime/reference-coverage";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { adminRoutes } from "./admin-api.ts";

import type { BetterAuthInstance } from "@repo/auth";

const origin = "http://localhost:3002";
const authStub = Auth.of({
  audience: APPLICATION.admin,
  instance: {
    options: {
      advanced: { cookiePrefix: "auth" },
      secret: "worker-test-secret-at-least-32-characters",
    },
  } as BetterAuthInstance,
});
const runtime = workerRuntime(() =>
  Layer.mergeAll(
    Layer.succeed(AppOrigin, origin),
    Layer.succeed(Auth, authStub),
    Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.admin }),
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
