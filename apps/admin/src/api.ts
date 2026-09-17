import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@template/runtime/contracts";
import { accountApi, unavailable } from "@template/runtime/account";
import {
  apiBridge,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@template/runtime/http";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import type { AppServices } from "@template/runtime";
import { Effect } from "effect";
import { verifySession } from "@template/auth";

const bridge = apiBridge<AppServices>();
const forbidden = { message: "この操作は許可されていません。", status: 403 };
const failures = {
  ...unavailable,
  AdminStrongSessionRequired: forbidden,
  LastAdminRequired: { message: "最後の管理者は削除・降格できません。", status: 409 },
  TargetUnavailable: { message: "対象が存在しないか、操作権限が失効しています。", status: 409 },
};

const api = createApi()
  .use(accountApi(bridge))
  .get(
    "/api/users",
    bridge.route(
      UserList,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request) =>
        Effect.gen(function* handleRequest() {
          const { session } = yield* verifySession(request.headers);
          const { keyword, limit, offset, role, verified } = yield* readSearchParams(
            UserListQuery,
            request,
          );
          return yield* listUsers(session.id, {
            limit,
            offset,
            ...(keyword === undefined ? {} : { keyword }),
            ...(role === undefined ? {} : { role }),
            ...(verified === undefined ? {} : { emailVerified: verified === "true" }),
          });
        }),
      failures,
    ),
  )
  .patch(
    "/api/users",
    bridge.route(
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
    bridge.route(
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

const adminApi = compileApi(api);
const dispatchAdminApi = bridge.dispatch;

export { adminApi, dispatchAdminApi };
