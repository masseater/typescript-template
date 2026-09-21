import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  GroupCreate,
  GroupCreated,
  GroupInviteRefresh,
  GroupInviteRefreshed,
  GroupJoin,
  GroupJoined,
  GroupLeave,
  GroupLeft,
  GroupQuery,
  GroupRename,
  GroupRenamed,
  GroupView,
} from "#shared/contracts/index.ts";
import {
  createGroup,
  findGroup,
  joinGroup,
  leaveGroup,
  refreshGroupInvite,
  renameGroup,
} from "./groups.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  GroupInviteExpired: {
    message: "招待リンクの期限が切れています。",
    status: httpStatus.forbidden,
  },
  GroupLimitReached: {
    message: "グループの上限に達しています。",
    status: httpStatus.forbidden,
  },
  GroupNotFound: { message: "グループが見つかりません。", status: httpStatus.notFound },
  MessagingMemberRequired: {
    message: "グループは会員だけが使えます。",
    status: httpStatus.forbidden,
  },
};

function groupsApi(api: ApiRoutes<AppServices>) {
  return createApi("/groups")
    .get(
      "/view",
      api.route(
        GroupView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id, invite } = yield* readSearchParams(GroupQuery, request);
            return yield* findGroup(user.id, id, invite);
          }),
        failures,
      ),
    )
    .post(
      "/create",
      api.route(
        GroupCreated,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const draft = yield* readJsonBody(GroupCreate, request);
            const created = yield* createGroup(user.id, draft);
            return {
              conversationId: created.conversationId,
              groupId: created.groupId,
              inviteToken: created.inviteToken,
            };
          }),
        failures,
      ),
    )
    .post(
      "/join",
      api.route(
        GroupJoined,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id, invite } = yield* readJsonBody(GroupJoin, request);
            return { conversationId: yield* joinGroup(user.id, id, invite) };
          }),
        failures,
      ),
    )
    .post(
      "/leave",
      api.route(
        GroupLeft,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(GroupLeave, request);
            yield* leaveGroup(user.id, id);
            return { id };
          }),
        failures,
      ),
    )
    .post(
      "/rename",
      api.route(
        GroupRenamed,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id, name } = yield* readJsonBody(GroupRename, request);
            yield* renameGroup(user.id, id, name);
            return { id };
          }),
        failures,
      ),
    )
    .post(
      "/invite",
      api.route(
        GroupInviteRefreshed,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id } = yield* readJsonBody(GroupInviteRefresh, request);
            return { inviteToken: yield* refreshGroupInvite(user.id, id) };
          }),
        failures,
      ),
    );
}

export { groupsApi };
