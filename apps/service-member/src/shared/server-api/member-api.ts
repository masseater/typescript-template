import { verifySession } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { UserNotFound } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { accountApi, sessionFailures } from "@repo/runtime/account";
import { apiDocs, apiRoot, createApi } from "@repo/runtime/http";
import { Effect } from "effect";

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
import { boardApi } from "./board-api.ts";
import { contactApi } from "./contact-api.ts";
import { flagsApi } from "./flags-api.ts";
import { interviewApi } from "./interview-api.ts";
import { socialApi } from "./social-api.ts";

import type { Interviewer } from "#shared/interview/index.ts";
import type { FeatureFlags } from "@repo/feature-flags";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";
import type { OpsMail } from "./ops-mail.ts";

const profileFailures = {
  ...sessionFailures,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

function memberRoutes(api: ApiRoutes<AppServices | FeatureFlags | Interviewer | OpsMail>) {
  return createApi(apiRoot)
    .use(apiDocs(APPLICATION.user))
    .use(accountApi(api))
    .use(contactApi(api))
    .use(flagsApi(api))
    .use(interviewApi(api))
    .use(socialApi(api))
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
    )
    .use(boardApi(api));
}

export { memberRoutes };
