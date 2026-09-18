import { apiRoutes, compileApi } from "@template/runtime/http";
import { assert, it } from "@effect/vitest";
import { Effect, ManagedRuntime } from "effect";
import { httpStatus } from "@template/observability";
import { referenceCoverage } from "@template/runtime/testing";
import { routes } from "#shared/telemetry/index.ts";
import { wikiLayer } from "@template/runtime/wiki";
import { wikiRoutes } from "./wiki-api.ts";

it.effect("the wiki api reference documents every route the wiki api serves", () =>
  Effect.gen(function* program() {
    const app = compileApi(wikiRoutes(apiRoutes(ManagedRuntime.make(wikiLayer({}, routes)))));
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.ok);
    assert.deepStrictEqual(coverage.documented, coverage.served);
    assert.includeMembers([...coverage.documented], ["GET /api/health", "GET /api/session"]);
  }),
);
