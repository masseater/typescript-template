import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@template/runtime/contracts";
import { accountApi, unavailable } from "@template/runtime/account";
import { apiRoutes, createApi, readJsonBody, readSearchParams } from "@template/runtime/http";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { Effect } from "effect";
import { runtime } from "./runtime.ts";
import { verifySession } from "@template/auth";

const api = apiRoutes(runtime);
const forbidden = { message: "この操作は許可されていません。", status: 403 };
const failures = {
  ...unavailable,
  AdminStrongSessionRequired: forbidden,
  LastAdminRequired: { message: "最後の管理者は削除・降格できません。", status: 409 },
  TargetUnavailable: { message: "対象が存在しないか、操作権限が失効しています。", status: 409 },
};

const adminApi = createApi()
  .use(accountApi(api))
  .get(
    "/api/users",
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
    "/api/users",
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
    "/api/users",
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

export { adminApi };
