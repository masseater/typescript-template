import { Effect, Layer, ManagedRuntime } from "effect";
import { apiRoutes, compileApi } from "@template/runtime/http";
import { assert, it } from "@effect/vitest";
import { Interviewer } from "@template/interview";
import { appLayer } from "@template/runtime";
import { httpStatus } from "@template/observability";
import { referenceCoverage } from "@template/runtime/testing";
import { routes } from "#shared/telemetry/index.ts";
import { userRoutes } from "./user-api.ts";

const unconfigured = {};

it.effect("the user api reference documents every route the user api serves", () =>
  Effect.gen(function* program() {
    const runtime = ManagedRuntime.make(
      Layer.merge(
        appLayer(unconfigured, "user", routes),
        Interviewer.fromEnvironment(unconfigured),
      ),
    );
    const app = compileApi(userRoutes(apiRoutes(runtime)));
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.ok);
    assert.deepStrictEqual(coverage.documented, coverage.served);
    assert.includeMembers(
      [...coverage.documented],
      ["GET /api/profile", "PATCH /api/profile", "POST /api/interview/turns"],
    );
  }),
);
