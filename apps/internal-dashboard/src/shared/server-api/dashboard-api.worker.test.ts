import { assert, it } from "@effect/vitest";
import { dashboardStaff, type ReadOnlyDashboardStaff } from "@repo/db/dashboard-staff";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";

import { dashboardApi } from "./dashboard-api.ts";
import { reporting, runtime } from "./runtime.ts";

function dashboardApp() {
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(dashboardApi(api));
}

async function postDashboard(path: string): Promise<number> {
  const app = dashboardApp();
  const response = await app.fetch(
    new Request(`${fixtureOrigin}${apiRoot}${path}`, {
      body: "{}",
      headers: { "content-type": "application/json", origin: fixtureOrigin },
      method: "POST",
    }),
  );
  return response.status;
}

it.effect("rejects write requests on dashboard routes", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* Effect.promise(async () => postDashboard("/overview")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(async () => postDashboard("/metrics/trend")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(async () => postDashboard("/audit")),
      httpStatus.notFound,
    );
  }),
);

it("exposes only read-only dashboard staff operations", () => {
  const staff: ReadOnlyDashboardStaff = dashboardStaff;
  assert.isFunction(staff.auditEvents);
  assert.isFunction(staff.metricTrend);
  assert.isFunction(staff.overview);
  assert.notProperty(staff, "refreshMetricSnapshots");
});
