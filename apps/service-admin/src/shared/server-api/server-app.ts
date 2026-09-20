import { verifySession } from "@repo/auth";
import {
  closeInquiry,
  countPendingInquiries,
  getAdminInquiry,
  getInquiryMemberSummary,
  listAdminInquiries,
  replyAsAdmin,
} from "@repo/db";
import { deleteUser, listUsers, setUserRole } from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { accountApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AdminInquiryList,
  AdminInquiryThread,
  InquiryClose,
  InquiryListQuery,
  InquiryMemberSummary,
  InquiryQuery,
  InquiryReply,
  MemberQuery,
  PendingCount,
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "#shared/contracts/index.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);
const forbidden = { message: "この操作は許可されていません。", status: httpStatus.forbidden };
const failures = {
  ...unavailable,
  AdminStrongSessionRequired: forbidden,
  InquiryForbidden: { message: "この問い合わせには返信できません。", status: httpStatus.conflict },
  InquiryNotFound: { message: "問い合わせが見つかりません。", status: httpStatus.notFound },
  LastAdminRequired: {
    message: "最後の管理者は削除・降格できません。",
    status: httpStatus.conflict,
  },
  TargetUnavailable: {
    message: "対象が存在しないか、操作権限が失効しています。",
    status: httpStatus.conflict,
  },
};

const adminApi = createApi(apiRoot)
  .use(accountApi(api))
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
    "/inquiries",
    api.route(
      AdminInquiryList,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const page = yield* readSearchParams(InquiryListQuery, request);
          return yield* listAdminInquiries(session.id, page);
        }),
      failures,
    ),
  )
  .get(
    "/inquiries/pending-count",
    api.route(
      PendingCount,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const count = yield* countPendingInquiries(session.id);
          return { count };
        }),
      failures,
    ),
  )
  .get(
    "/inquiries/detail",
    api.route(
      AdminInquiryThread,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const { id } = yield* readSearchParams(InquiryQuery, request);
          return yield* getAdminInquiry(session.id, id);
        }),
      failures,
    ),
  )
  .get(
    "/inquiries/member",
    api.route(
      InquiryMemberSummary,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const { id } = yield* readSearchParams(MemberQuery, request);
          return yield* getInquiryMemberSummary(session.id, id);
        }),
      failures,
    ),
  )
  .post(
    "/inquiries/reply",
    api.route(
      AdminInquiryThread,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const { body, id } = yield* readJsonBody(InquiryReply, request);
          return yield* replyAsAdmin(session.id, id, body);
        }),
      failures,
    ),
  )
  .post(
    "/inquiries/close",
    api.route(
      AdminInquiryThread,
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const { id } = yield* readJsonBody(InquiryClose, request);
          return yield* closeInquiry(session.id, id);
        }),
      failures,
    ),
  );

export { adminApi };
