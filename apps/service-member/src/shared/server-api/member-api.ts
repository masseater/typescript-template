import { apiKeyWriteFailure, verifySessionOrApiKey, verifySessionWriter } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { UserNotFound, requirePaid } from "@repo/db";
import { accountApi } from "@repo/runtime/account";
import { apiDocs, apiRoot, createApi } from "@repo/runtime/http";
import { Effect } from "effect";

import { paidFailures } from "#shared/billing/index.ts";
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
import { agreementApi, consentGate } from "./agreement-api.ts";
import { billingApi } from "./billing-api.ts";
import { boardApi } from "./board-api.ts";
import { contactApi } from "./contact-api.ts";
import { flagsApi } from "./flags-api.ts";
import { interviewApi } from "./interview-api.ts";
import { leaveApi } from "./leave-api.ts";
import { memberFailures } from "./member-failures.ts";
import { photoApi } from "./photo-api.ts";
import { onboardingStepApi, socialApi } from "./social-api.ts";
import { visibilityApi } from "./visibility-api.ts";

import type { Stripe } from "#shared/billing/index.ts";
import type { Interviewer } from "#shared/interview/index.ts";
import type { PhotoStore } from "#shared/photo/index.ts";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";
import type { OpsMail } from "./ops-mail.ts";

const failures = { ...memberFailures, ...apiKeyWriteFailure, ...paidFailures };

function memberApi(api: ApiRoutes<AppServices | Interviewer | OpsMail | PhotoStore | Stripe>) {
  return createApi(apiRoot)
    .use(apiDocs(APPLICATION.user))
    .use(accountApi(api))
    .use(contactApi(api))
    .use(flagsApi(api))
    .use(agreementApi(api))
    .use(onboardingStepApi(api))
    .use(leaveApi(api))
    .use(billingApi(api))
    .onBeforeHandle(consentGate(api))
    .use(interviewApi(api))
    .use(photoApi(api))
    .use(socialApi(api))
    .use(visibilityApi(api))
    .get(
      "/profile",
      ...api.route(
        { response: ProfileView },
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySessionOrApiKey(request.headers);
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
      ...api.route(
        { query: MemberQuery, response: MemberView },
        (request, { id }) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySessionOrApiKey(request.headers);
            return yield* getMember(user.id, id);
          }),
        failures,
      ),
    )
    .get(
      "/members",
      ...api.route(
        { query: MemberListQuery, response: MemberList },
        (request, { keyword, page }) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySessionOrApiKey(request.headers);
            yield* requirePaid(user.id);
            const offset = (page - 1) * memberPageSize;
            const list = yield* listMembers({ keyword, limit: memberPageSize, offset });
            return { ...list, pageSize: memberPageSize };
          }),
        failures,
      ),
    )
    .patch(
      "/profile",
      ...api.route(
        { body: ProfileUpdate, response: ProfileView },
        (request, values) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySessionWriter(request.headers);
            return yield* updateProfile(user.id, values);
          }),
        failures,
      ),
    )
    .use(boardApi(api));
}

export { memberApi };
