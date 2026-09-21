import { apiKeyWriteFailure, verifySessionOrApiKey, verifySessionWriter } from "@repo/auth";
import { UserNotFound, requirePaid } from "@repo/db";
import { accountApi } from "@repo/runtime/account";
import { apiRoot, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
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
import { messagingApi } from "./messaging-api.ts";
import { photoApi } from "./photo-api.ts";
import { onboardingStepApi, socialApi } from "./social-api.ts";
import { trustApi } from "./trust-api.ts";
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
      api.route(
        ProfileView,
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
      api.route(
        MemberView,
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySessionOrApiKey(request.headers);
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
            const { user } = yield* verifySessionOrApiKey(request.headers);
            yield* requirePaid(user.id);
            const { keyword, page } = yield* readSearchParams(MemberListQuery, request);
            const offset = (page - 1) * memberPageSize;
            const list = yield* listMembers(user.id, { keyword, limit: memberPageSize, offset });
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
            const { user } = yield* verifySessionWriter(request.headers);
            const values = yield* readJsonBody(ProfileUpdate, request);
            return yield* updateProfile(user.id, values);
          }),
        failures,
      ),
    )
    .use(boardApi(api))
    .use(messagingApi(api))
    .use(trustApi(api));
}

export { memberApi };
