import { mailInvite, verifySession } from "@repo/auth";
import { inviteStaff, listStaff, removeStaff, setStaffPermission } from "@repo/db/staff";
import { httpStatus } from "@repo/config";
import { inviteApi, privileged } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  StaffInvitation,
  StaffInvited,
  StaffList,
  StaffPermissionChange,
  StaffPermissionChanged,
  StaffRemoval,
  StaffRemoved,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...privileged,
  LastEditorRequired: {
    message: "最後の「変更できる」メンバーは下げられません。",
    status: httpStatus.conflict,
  },
};

const sessionOf = Effect.fn("sessionOf")(function* sessionOf(request: Request) {
  const { session } = yield* verifySession(request.headers);
  return session.id;
});

const listMembers = Effect.fn("listMembers")(function* listMembers(request: Request) {
  return yield* listStaff(yield* sessionOf(request));
});

const inviteMember = Effect.fn("inviteMember")(function* inviteMember(request: Request) {
  const sessionId = yield* sessionOf(request);
  const invitation = yield* readJsonBody(StaffInvitation, request);
  const issued = yield* inviteStaff({ ...invitation, sessionId });
  yield* mailInvite(issued);
  return { email: issued.email, expiresAt: issued.expiresAt };
});

const changeMemberPermission = Effect.fn("changeMemberPermission")(function* changeMemberPermission(
  request: Request,
) {
  const sessionId = yield* sessionOf(request);
  const change = yield* readJsonBody(StaffPermissionChange, request);
  return yield* setStaffPermission({
    permission: change.permission,
    sessionId,
    staffId: change.id,
  });
});

const removeMember = Effect.fn("removeMember")(function* removeMember(request: Request) {
  const sessionId = yield* sessionOf(request);
  const removal = yield* readJsonBody(StaffRemoval, request);
  return yield* removeStaff(sessionId, removal.id);
});

function staffApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .use(inviteApi(api))
    .get("/staff", api.route(StaffList, listMembers, failures))
    .post("/staff/invites", api.route(StaffInvited, inviteMember, failures))
    .patch("/staff", api.route(StaffPermissionChanged, changeMemberPermission, failures))
    .delete("/staff", api.route(StaffRemoved, removeMember, failures));
}

export { staffApi };
