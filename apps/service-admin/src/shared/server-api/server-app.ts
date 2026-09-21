import { verifySession } from "@repo/auth";
import { deleteUser, listUsers, setUserRole } from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { accountApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
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
          return yield* setUserRole({
            role: change.role,
            sessionId: session.id,
            targetId: change.id,
          });
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
  );

export { adminApi };
