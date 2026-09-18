import {
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  memberPageSize,
} from "@template/runtime/contracts";
import { UserNotFound, getMember, getProfile, listMembers, updateProfile } from "@template/db";
import { accountApi, sessionFailures } from "@template/runtime/account";
import { apiDocs, apiRoot, createApi } from "@template/runtime/http";
import type { ApiRoutes } from "@template/runtime/http";
import type { AppServices } from "@template/runtime";
import { Effect } from "effect";
import type { Interviewer } from "@template/interview";
import { httpStatus } from "@template/observability";
import { interviewApi } from "./interview-api.ts";
import { verifySession } from "@template/auth";

const profileFailures = {
  ...sessionFailures,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

function userRoutes(api: ApiRoutes<AppServices | Interviewer>) {
  return createApi(apiRoot)
    .use(apiDocs("user"))
    .use(accountApi(api))
    .use(interviewApi(api))
    .get(
      "/profile",
      ...api.route(
        { response: ProfileView },
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            const profile = yield* getProfile(user.id);
            if (profile === null) {
              return yield* new UserNotFound();
            }
            return profile;
          }),
        profileFailures,
      ),
    )
    .get(
      "/member",
      ...api.route(
        { query: MemberQuery, response: MemberView },
        (request, { id }) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            return yield* getMember(user.id, id);
          }),
        profileFailures,
      ),
    )
    .get(
      "/members",
      ...api.route(
        { query: MemberListQuery, response: MemberList },
        (request, { keyword, page }) =>
          Effect.gen(function* handleRequest() {
            yield* verifySession(request.headers);
            const offset = (page - 1) * memberPageSize;
            const list = yield* listMembers({ keyword, limit: memberPageSize, offset });
            return { ...list, pageSize: memberPageSize };
          }),
        sessionFailures,
      ),
    )
    .patch(
      "/profile",
      ...api.route(
        { body: ProfileUpdate, response: ProfileView },
        (request, values) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            return yield* updateProfile(user.id, values);
          }),
        profileFailures,
      ),
    );
}

export { userRoutes };
