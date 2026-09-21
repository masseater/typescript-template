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

const sessionOf = Effect.fn("reports.session")(function* sessionOf(request: Request) {
  const { session } = yield* verifySession(request.headers);
  return session.id;
});

const listPage = Effect.fn("reports.list")(function* listPage(request: Request) {
  const sessionId = yield* sessionOf(request);
  const query = yield* readSearchParams(ReportListQuery, request);
  const list = yield* listReports(sessionId, {
    limit: reportPageSize,
    offset: (query.page - 1) * reportPageSize,
    ...(query.status === undefined ? {} : { status: query.status }),
  });
  return { ...list, pageSize: 20 as const };
});

const detail = Effect.fn("reports.detail")(function* detail(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readSearchParams(ReportQuery, request);
  return yield* readReport(sessionId, id);
});

const suspend = Effect.fn("reports.suspend")(function* suspend(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readJsonBody(ReportAction, request);
  yield* suspendTarget(sessionId, id, true);
  return { ok: true as const };
});

const unsuspend = Effect.fn("reports.unsuspend")(function* unsuspend(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readJsonBody(ReportAction, request);
  yield* suspendTarget(sessionId, id, false);
  return { ok: true as const };
});

const warn = Effect.fn("reports.warn")(function* warn(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readJsonBody(ReportAction, request);
  yield* warnTarget(sessionId, id);
  return { ok: true as const };
});

const dismiss = Effect.fn("reports.dismiss")(function* dismiss(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readJsonBody(ReportAction, request);
  yield* dismissReport(sessionId, id);
  return { ok: true as const };
});

function reportApi(api: ApiRoutes<AppServices>) {
  return createApi("/reports")
    .get("/", api.route(ReportList, listPage, failures))
    .get("/detail", api.route(ReportDetail, detail, failures))
    .post("/suspend", api.route(ReportActionResult, suspend, failures))
    .post("/unsuspend", api.route(ReportActionResult, unsuspend, failures))
    .post("/warn", api.route(ReportActionResult, warn, failures))
    .post("/dismiss", api.route(ReportActionResult, dismiss, failures));
}

export { reportApi };
