import { verifySession } from "@template/auth";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { httpStatus } from "@template/observability";
import { accountApi, unavailable } from "@template/runtime/account";
import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@template/runtime/contracts";
import {
  apiRoot,
  apiRoutes,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@template/runtime/http";
import { Effect } from "effect";

import { runtime } from "./runtime.ts";

const api = apiRoutes(runtime);
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

const app = createApi(apiRoot)
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

const adminApi = compileApi(app);

export { adminApi };
