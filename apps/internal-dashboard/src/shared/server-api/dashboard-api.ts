import { AuditPage, TrendQuery } from "@repo/config/paging";
import { dashboardStaff } from "@repo/db";
import { sessionFailures } from "@repo/runtime/account";
import { createApi, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { MetricTrend, StaffAuditPage, StaffOverview } from "#shared/contracts/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = { ...sessionFailures };

function dashboardApi(api: ApiRoutes<WikiServices>) {
  return createApi("")
    .get(
      "/overview",
      ...api.route({ response: StaffOverview }, () => dashboardStaff.overview(), failures),
    )
    .get(
      "/metrics/trend",
      ...api.route(
        { response: MetricTrend },
        (request) =>
          Effect.gen(function* handle() {
            const query = yield* readSearchParams(TrendQuery, request);
            return yield* dashboardStaff.metricTrend(query);
          }),
        failures,
      ),
    )
    .get(
      "/audit",
      ...api.route(
        { response: StaffAuditPage },
        (request) =>
          Effect.gen(function* handle() {
            const page = yield* readSearchParams(AuditPage, request);
            return yield* dashboardStaff.auditEvents(page);
          }),
        failures,
      ),
    );
}

export { dashboardApi };
