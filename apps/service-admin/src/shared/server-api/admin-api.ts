import { verifySession } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { deleteUser, listUsers, setUserRole } from "@repo/db/admin";
import { httpStatus } from "@repo/observability";
import { accountApi, forbidden, sessionFailures } from "@repo/runtime/account";
import { apiDocs, apiRoot, createApi } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  RoleChange,
  RoleChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

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
        APPLICATION.admin,
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
