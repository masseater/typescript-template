import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  GroupCreate,
  GroupCreated,
  GroupJoin,
  GroupJoined,
  GroupQuery,
  GroupView,
  OpenGroupList,
} from "#shared/contracts/index.ts";
import { createGroup, findGroup, joinGroup, listOpenGroups } from "./groups.ts";

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
      "/open",
      api.route(
        OpenGroupList,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { groups: yield* listOpenGroups(user.id) };
          }),
        failures,
      ),
    )
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
            return yield* createGroup(user.id, draft);
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
    );
}

export { groupsApi };
