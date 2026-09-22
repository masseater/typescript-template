import { apiKeyWriteFailure } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import {
  accountApi,
  getMember,
  getMemberProfile,
  listMembers,
  requirePaidMembership,
  updateMemberProfile,
} from "@repo/runtime/account";
import { apiDocs, apiRoot, createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
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
import { agreementApi, consentGate } from "./agreement-api.ts";
import { billingApi } from "./billing-api.ts";
import { boardApi } from "./board-api.ts";
import { contactApi } from "./contact-api.ts";
import { flagsApi } from "./flags-api.ts";
import { groupsApi } from "./groups-api.ts";
import { interviewApi } from "./interview-api.ts";
import { jobsApi } from "./jobs-api.ts";
import { leaveApi } from "./leave-api.ts";
import { memberFailures } from "./member-failures.ts";
import { messagingApi } from "./messaging-api.ts";
import { photoApi } from "./photo-api.ts";
import { realtimeApi } from "./realtime-api.ts";
import { onboardingStepApi, socialApi } from "./social-api.ts";
import { supportApi } from "./support-api.ts";
import { trustApi } from "./trust-api.ts";
import { visibilityApi } from "./visibility-api.ts";

import type { Stripe } from "#shared/billing/index.ts";
import type { Interviewer } from "#shared/interview/server.ts";
import type { PhotoStore } from "#shared/photo/index.ts";
import type { ProfileLayoutAssembler } from "#shared/profile-layout/assembler.ts";
import type { FeatureFlags } from "@repo/feature-flags";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";
import type { OpsMail } from "./ops-mail.ts";

const failures = {
  ...memberFailures,
  ...apiKeyWriteFailure,
  ...paidFailures,
  MemberProfileNotFound: memberFailures.UserNotFound,
};

function memberApi(
  api: ApiRoutes<
    | AppServices
    | FeatureFlags
    | Interviewer
    | OpsMail
    | PhotoStore
    | ProfileLayoutAssembler
    | Stripe
  >,
) {
  return createApi(apiRoot)
    .use(apiDocs(APPLICATION.user))
    .use(accountApi(api))
    .use(contactApi(api))
    .use(flagsApi(api))
    .use(agreementApi(api))
    .use(onboardingStepApi(api))
    .use(leaveApi(api))
    .use(supportApi(api))
    .use(billingApi(api))
    .beforeHandle(consentGate(api))
    .use(interviewApi(api))
    .use(jobsApi(api))
    .use(realtimeApi(api))
    .use(photoApi(api))
    .use(socialApi(api))
    .use(visibilityApi(api))
    .get(
      "/profile",
      ...api.route({ response: ProfileView }, (request) => getMemberProfile(request), failures),
    )
    .get(
      "/member",
      ...api.route(
        { response: MemberView },
        (request) =>
          Effect.gen(function* handleRequest() {
            const { id } = yield* readSearchParams(MemberQuery, request);
            return yield* getMember(request, id);
          }),
        failures,
      ),
    )
    .get(
      "/members",
      ...api.route(
        { response: MemberList },
        (request) =>
          Effect.gen(function* handleRequest() {
            yield* requirePaidMembership(request);
            const { keyword, page } = yield* readSearchParams(MemberListQuery, request);
            const list = yield* listMembers(request, {
              keyword,
              limit: memberPageSize,
              offset: (page - 1) * memberPageSize,
            });
            return { ...list, pageSize: memberPageSize };
          }),
        failures,
      ),
    )
    .patch(
      "/profile",
      ...api.route(
        { response: ProfileView },
        (request) =>
          Effect.gen(function* handleRequest() {
            const values = yield* readJsonBody(ProfileUpdate, request);
            return yield* updateMemberProfile(request, values);
          }),
        failures,
      ),
    )
    .use(boardApi(api))
    .use(groupsApi(api))
    .use(messagingApi(api))
    .use(trustApi(api));
}

export { memberApi };
