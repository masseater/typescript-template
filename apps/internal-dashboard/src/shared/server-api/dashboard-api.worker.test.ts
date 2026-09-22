import { assert, it } from "@effect/vitest";
import { dashboardStaff, type ReadOnlyDashboardStaff } from "@repo/db";
import { httpStatus } from "@repo/config";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";

import { dashboardApi } from "./dashboard-api.ts";
import { reporting, runtime } from "./runtime.ts";

function dashboardApp() {
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(dashboardApi(api));
}

function postDashboard(path: string): Promise<number> {
  const app = dashboardApp();
  return Promise.resolve(
    app.fetch(
      new Request(`${fixtureOrigin}${apiRoot}${path}`, {
        body: "{}",
        headers: { "content-type": "application/json", origin: fixtureOrigin },
        method: "POST",
      }),
    ),
  ).then((response) => response.status);
}

it.effect("rejects write requests on dashboard routes", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* Effect.promise(() => postDashboard("/overview")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(() => postDashboard("/metrics/trend")),
      httpStatus.notFound,
    );
    assert.strictEqual(yield* Effect.promise(() => postDashboard("/audit")), httpStatus.notFound);
  }),
);

it("exposes only read-only dashboard staff operations", () => {
  const staff: ReadOnlyDashboardStaff = dashboardStaff;
  assert.isFunction(staff.auditEvents);
  assert.isFunction(staff.metricTrend);
  assert.isFunction(staff.overview);
  assert.notProperty(staff, "refreshMetricSnapshots");
});
