import { assert, it } from "@effect/vitest";
import { SessionRequired } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { AppOrigin, apiDocs, apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { referenceCoverage } from "@repo/runtime/reference-coverage";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { adminRoutes } from "./admin-api.ts";

const origin = "http://localhost:3002";
const loginRequired = { message: "ログインしてください。", status: httpStatus.unauthorized };
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
    const guarded = createApi(apiRoot).use(
      apiDocs(
        APPLICATION.admin,
        api.guard(
          (request) =>
            request.headers.get("cookie") === "session=1"
              ? Effect.void
              : Effect.fail(new SessionRequired()),
          { SessionRequired: loginRequired },
        ),
      ),
    );
    const coverage = yield* referenceCoverage(guarded);
    assert.strictEqual(coverage.status, httpStatus.unauthorized);
    const app = adminRoutes(api);
    assert.includeMembers(
      [...(yield* referenceCoverage(app)).served],
      ["GET /api/users", "PATCH /api/users", "DELETE /api/users"],
    );
  }),
);
