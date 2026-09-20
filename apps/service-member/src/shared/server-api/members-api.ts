import { verifySession } from "@repo/auth";
import { UserNotFound } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { paidFailures, requirePaidSession } from "#shared/billing/index.ts";
import {
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  memberPageSize,
} from "#shared/contracts/index.ts";
import { getMember, getProfile, listMembers, updateProfile } from "#shared/members/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  ...paidFailures,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

function membersApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/profile",
      api.route(
        ProfileView,
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            const profile = yield* getProfile(user.id);
            if (profile === null) {
              return yield* new UserNotFound();
            }
            return profile;
          }),
        failures,
      ),
    )
    .get(
      "/member",
      api.route(
        MemberView,
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            const { id } = yield* readSearchParams(MemberQuery, request);
            return yield* getMember(user.id, id);
          }),
        failures,
      ),
    )
    .get(
      "/members",
      api.route(
        MemberList,
        (request) =>
          Effect.gen(function* handleRequest() {
            yield* requirePaidSession(request.headers);
            const { keyword, page } = yield* readSearchParams(MemberListQuery, request);
            const offset = (page - 1) * memberPageSize;
            const list = yield* listMembers({ keyword, limit: memberPageSize, offset });
            return { ...list, pageSize: memberPageSize };
          }),
        failures,
      ),
    )
    .patch(
      "/profile",
      api.route(
        ProfileView,
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            const values = yield* readJsonBody(ProfileUpdate, request);
            return yield* updateProfile(user.id, values);
          }),
        failures,
      ),
    );
}

export { membersApi };
