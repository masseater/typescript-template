import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@repo/runtime/contracts";
import { accountApi, unavailable } from "@repo/runtime/account";
import {
  apiRoot,
  apiRoutes,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@repo/runtime/http";
import { deleteUser, listUsers, setUserRole } from "@repo/db/admin";
import { Effect } from "effect";
import { httpStatus } from "@repo/observability";
import { runtime } from "./runtime.ts";
import { verifySession } from "@repo/auth";

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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
