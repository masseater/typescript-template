import { verifySession } from "@template/auth";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import type { AppServices } from "@template/runtime";
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
  apiBridge,
  compileApi,
  createApi,
  readJsonBody,
  readSearchParams,
} from "@template/runtime/http";
import { Effect } from "effect";

const bridge = apiBridge<AppServices>();
const forbidden = { status: 403, message: "この操作は許可されていません。" };
const failures = {
  ...unavailable,
  AdminStrongSessionRequired: forbidden,
  LastAdminRequired: { status: 409, message: "最後の管理者は削除・降格できません。" },
  TargetUnavailable: { status: 409, message: "対象が存在しないか、操作権限が失効しています。" },
};

const api = createApi()
  .use(accountApi(bridge))
  .get(
    "/api/users",
    bridge.route(
      UserList,
      (request) =>
        Effect.gen(function* () {
          const { session } = yield* verifySession(request.headers);
          const page = yield* readSearchParams(UserListQuery, request);
          return yield* listUsers(session.id, page);
        }),
      failures,
    ),
  )
  .patch(
    "/api/users",
    bridge.route(
      RoleChanged,
      (request) =>
        Effect.gen(function* () {
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
      (request) =>
        Effect.gen(function* () {
          const { session } = yield* verifySession(request.headers);
          const deletion = yield* readJsonBody(UserDeletion, request);
          return yield* deleteUser(session.id, deletion.id);
        }),
      failures,
    ),
  );

export const adminApi = compileApi(api);
export const dispatchAdminApi = bridge.dispatch;
