import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "@template/runtime/contracts";
import { accountApi, forbidden, sessionFailures } from "@template/runtime/account";
import { apiDocs, apiRoot, createApi } from "@template/runtime/http";
import type { ApiRoutes } from "@template/runtime/http";
import type { AppServices } from "@template/runtime";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { Effect } from "effect";
import { httpStatus } from "@template/observability";
import { verifySession } from "@template/auth";

const listFailures = { ...sessionFailures, AdminStrongSessionRequired: forbidden };
const changeFailures = {
  ...listFailures,
  LastAdminRequired: {
    message: "最後の管理者は削除・降格できません。",
    status: httpStatus.conflict,
  },
  TargetUnavailable: {
    message: "対象が存在しないか、操作権限が失効しています。",
    status: httpStatus.conflict,
  },
};

function adminRoutes(api: ApiRoutes<AppServices>) {
  return createApi(apiRoot)
    .use(
      apiDocs(
        "admin",
        api.guard((request) => verifySession(request.headers), sessionFailures),
      ),
    )
    .use(accountApi(api))
    .get(
      "/users",
      ...api.route(
        { query: UserListQuery, response: UserList },
        (request, page) =>
          Effect.gen(function* handleRequest() {
            const { session } = yield* verifySession(request.headers);
            return yield* listUsers(session.id, page);
          }),
        listFailures,
      ),
    )
    .patch(
      "/users",
      ...api.route(
        { body: RoleChange, response: RoleChanged },
        (request, change) =>
          Effect.gen(function* handleRequest() {
            const { session } = yield* verifySession(request.headers);
            return yield* setUserRole(session.id, change.id, change.role);
          }),
        changeFailures,
      ),
    )
    .delete(
      "/users",
      ...api.route(
        { body: UserDeletion, response: UserDeleted },
        (request, deletion) =>
          Effect.gen(function* handleRequest() {
            const { session } = yield* verifySession(request.headers);
            return yield* deleteUser(session.id, deletion.id);
          }),
        changeFailures,
      ),
    );
}

export { adminRoutes };
