import { verifySession } from "@repo/auth";
import {
  deleteUser,
  dismissReport,
  listReports,
  listUsers,
  readReport,
  setUserRole,
  suspendTarget,
  warnTarget,
} from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { accountApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  ReportAction,
  ReportActionResult,
  ReportDetail,
  ReportList,
  ReportListQuery,
  ReportQuery,
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
  reportPageSize,
} from "#shared/contracts/index.ts";
import { agreementApi } from "./agreement-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);
const forbidden = { message: "この操作は許可されていません。", status: httpStatus.forbidden };
const failures = {
  ...unavailable,
  AdminStrongSessionRequired: forbidden,
  LastAdminRequired: {
    message: "最後の管理者は削除・降格できません。",
    status: httpStatus.conflict,
  },
  TargetUnavailable: {
    message: "対象が存在しないか、操作権限が失効しています。",
    status: httpStatus.conflict,
  },
  TrustSubjectNotFound: {
    message: "通報が見つかりません。",
    status: httpStatus.notFound,
  },
  TrustTargetUnavailable: {
    message: "この通報には停止できる対象がいません。",
    status: httpStatus.conflict,
  },
};

const adminApi = createApi(apiRoot)
  .use(accountApi(api))
  .use(agreementApi(api))
  .get(
    "/users",
    api.route(
      UserList,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const page = yield* readSearchParams(UserListQuery, request);
          return yield* listUsers(session.id, page);
        }),
      failures,
    ),
  )
  .patch(
    "/users",
    api.route(
      RoleChanged,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const change = yield* readJsonBody(RoleChange, request);
          return yield* setUserRole(session.id, change.id, change.role);
        }),
      failures,
    ),
  )
  .delete(
    "/users",
    api.route(
      UserDeleted,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const deletion = yield* readJsonBody(UserDeletion, request);
          return yield* deleteUser(session.id, deletion.id);
        }),
      failures,
    ),
  )
  .get(
    "/reports",
    api.route(
      ReportList,
      (request) =>
        Effect.gen(function* handle() {
          const { session } = yield* verifySession(request.headers);
          const page = yield* readSearchParams(ReportListQuery, request);
          const list = yield* listReports(session.id, {
            limit: reportPageSize,
            offset: (page.page - 1) * reportPageSize,
            status: page.status,
          });
          return { ...list, pageSize: reportPageSize };
        }),
      failures,
    ),
  )
  .get(
    "/reports/item",
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
    "/reports/suspend",
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
    "/reports/unsuspend",
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
    "/reports/warn",
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
    "/reports/dismiss",
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

export { adminApi };
