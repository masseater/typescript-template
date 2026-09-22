import { mailInvite, verifySession } from "@repo/auth";
import {
  deleteUser,
  inviteAdmin,
  listAdmins,
  listUsers,
  setAdminPermission,
  setAdminState,
  setMemberState,
} from "@repo/db/admin";
import { httpStatus } from "@repo/config";
import { inviteApi, privileged } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AdminInvitation,
  AdminInvited,
  AdminList,
  AdminPermissionChange,
  AdminPermissionChanged,
  AdminStateChange,
  AdminStateChanged,
  MemberStateChange,
  MemberStateChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...privileged,
  LastAdminRequired: {
    message: "最後の「管理者を追加できる」管理者は下げられません。",
    status: httpStatus.conflict,
  },
};

const sessionOf = Effect.fn("sessionOf")(function* sessionOf(request: Request) {
  const { session } = yield* verifySession(request.headers);
  return session.id;
});

const listMembers = Effect.fn("listMembers")(function* listMembers(request: Request) {
  const sessionId = yield* sessionOf(request);
  const page = yield* readSearchParams(UserListQuery, request);
  return yield* listUsers(sessionId, page);
});

const changeMemberState = Effect.fn("changeMemberState")(function* changeMemberState(
  request: Request,
) {
  const sessionId = yield* sessionOf(request);
  const change = yield* readJsonBody(MemberStateChange, request);
  return yield* setMemberState({
    accountState: change.accountState,
    memberId: change.id,
    sessionId,
  });
});

const removeMember = Effect.fn("removeMember")(function* removeMember(request: Request) {
  const sessionId = yield* sessionOf(request);
  const deletion = yield* readJsonBody(UserDeletion, request);
  return yield* deleteUser(sessionId, deletion.id);
});

const listAdministrators = Effect.fn("listAdministrators")(function* listAdministrators(
  request: Request,
) {
  return yield* listAdmins(yield* sessionOf(request));
});

const inviteAdministrator = Effect.fn("inviteAdministrator")(function* inviteAdministrator(
  request: Request,
) {
  const sessionId = yield* sessionOf(request);
  const invitation = yield* readJsonBody(AdminInvitation, request);
  const issued = yield* inviteAdmin({ ...invitation, sessionId });
  yield* mailInvite(issued);
  return { email: issued.email, expiresAt: issued.expiresAt };
});

const changeAdminPermission = Effect.fn("changeAdminPermission")(function* changeAdminPermission(
  request: Request,
) {
  const sessionId = yield* sessionOf(request);
  const change = yield* readJsonBody(AdminPermissionChange, request);
  return yield* setAdminPermission({
    adminId: change.id,
    permission: change.permission,
    sessionId,
  });
});

const changeAdminState = Effect.fn("changeAdminState")(function* changeAdminState(
  request: Request,
) {
  const sessionId = yield* sessionOf(request);
  const change = yield* readJsonBody(AdminStateChange, request);
  return yield* setAdminState({
    accountState: change.accountState,
    adminId: change.id,
    sessionId,
  });
});

function adminRoutes<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .use(inviteApi(api))
    .get("/users", api.route(UserList, listMembers, failures))
    .patch("/users", api.route(MemberStateChanged, changeMemberState, failures))
    .delete("/users", api.route(UserDeleted, removeMember, failures))
    .get("/admins", api.route(AdminList, listAdministrators, failures))
    .post("/admins/invites", api.route(AdminInvited, inviteAdministrator, failures))
    .patch("/admins", api.route(AdminPermissionChanged, changeAdminPermission, failures))
    .patch("/admins/state", api.route(AdminStateChanged, changeAdminState, failures));
}

export { adminRoutes };
