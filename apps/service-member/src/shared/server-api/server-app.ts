import { verifySession } from "@repo/auth";
import { UserNotFound, getMember, getProfile, listMembers, updateProfile } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { accountApi, unavailable } from "@repo/runtime/account";
import { contactApi } from "@repo/runtime/contact";
import {
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  memberPageSize,
} from "@repo/runtime/contracts";
import { apiRoot, apiRoutes, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { interviewApi } from "./interview-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);
const failures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

const userApi = createApi(apiRoot)
  .use(accountApi(api))
  .use(contactApi(api))
  .use(interviewApi(api))
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
          yield* verifySession(request.headers);
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

export { userApi };
