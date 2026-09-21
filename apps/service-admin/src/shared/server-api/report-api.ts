import { verifySession } from "@repo/auth";
import { dismissReport, listReports, readReport, suspendTarget, warnTarget } from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { privileged } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  ReportAction,
  ReportActionResult,
  ReportDetail,
  ReportList,
  ReportListQuery,
  ReportQuery,
  reportPageSize,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...privileged,
  TrustSubjectNotFound: {
    message: "通報が見つかりません。",
    status: httpStatus.notFound,
  },
  TrustTargetUnavailable: {
    message: "対象が見つかりません。",
    status: httpStatus.notFound,
  },
};

function reportApi(api: ApiRoutes<AppServices>) {
  return createApi("/reports")
    .get(
      "/",
      api.route(
        ReportList,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const query = yield* readSearchParams(ReportListQuery, request);
            const list = yield* listReports(session.id, {
              limit: reportPageSize,
              offset: (query.page - 1) * reportPageSize,
              status: query.status,
            });
            return { ...list, pageSize: reportPageSize };
          }),
        failures,
      ),
    )
    .get(
      "/detail",
      api.route(
        ReportDetail,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readSearchParams(ReportQuery, request);
            return yield* readReport(session.id, id);
          }),
        failures,
      ),
    )
    .post(
      "/suspend",
      api.route(
        ReportActionResult,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(ReportAction, request);
            yield* suspendTarget(session.id, id, true);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/unsuspend",
      api.route(
        ReportActionResult,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(ReportAction, request);
            yield* suspendTarget(session.id, id, false);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/warn",
      api.route(
        ReportActionResult,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(ReportAction, request);
            yield* warnTarget(session.id, id);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/dismiss",
      api.route(
        ReportActionResult,
        (request) =>
          Effect.gen(function* handle() {
            const { session } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(ReportAction, request);
            yield* dismissReport(session.id, id);
            return { ok: true as const };
          }),
        failures,
      ),
    );
}

export { reportApi };
