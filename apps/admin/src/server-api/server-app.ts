import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@template/runtime/contracts";
import { accountApi, unavailable } from "@template/runtime/account";
import { apiDocs, apiRoot, apiRoutes, compileApi, createApi } from "@template/runtime/http";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { Effect } from "effect";
import { httpStatus } from "@template/observability";
import { runtime } from "./runtime.ts";
import { verifySession } from "@template/auth";

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
  .use(apiDocs("admin"))
  .use(accountApi(api))
  .get(
    "/users",
    ...api.route(
      { query: UserListQuery, response: UserList },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, page) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          return yield* listUsers(session.id, page);
        }),
      failures,
    ),
  )
  .patch(
    "/users",
    ...api.route(
      { body: RoleChange, response: RoleChanged },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, change) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          return yield* setUserRole(session.id, change.id, change.role);
        }),
      failures,
    ),
  )
  .delete(
    "/users",
    ...api.route(
      { body: UserDeletion, response: UserDeleted },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request, deletion) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          return yield* deleteUser(session.id, deletion.id);
        }),
      failures,
    ),
  );

const adminApi = compileApi(app);

export { adminApi };
