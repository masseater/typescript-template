import { verifySession } from "@repo/auth";
import {
  InquiryForbidden,
  InquiryNotFound,
  createMemberInquiry,
  getMemberInquiry,
  listMemberInquiries,
  replyAsMember,
} from "@repo/db";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  InquiryCreate,
  InquiryList,
  InquiryQuery,
  InquiryReply,
  InquiryThread,
} from "#shared/contracts/support.ts";
import { presentSummary, presentThread } from "./support-present.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  InquiryForbidden: { message: "この問い合わせには返信できません。", status: httpStatus.conflict },
  InquiryNotFound: { message: "問い合わせが見つかりません。", status: httpStatus.notFound },
};

function supportApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/support",
      api.route(
        InquiryList,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const inquiries = yield* listMemberInquiries(user.id);
            return { inquiries: inquiries.map(presentSummary) };
          }),
        failures,
      ),
    )
    .get(
      "/support/detail",
      api.route(
        InquiryThread,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { id } = yield* readSearchParams(InquiryQuery, request);
            return presentThread(yield* getMemberInquiry(user.id, id));
          }),
        failures,
      ),
    )
    .post(
      "/support",
      api.route(
        InquiryThread,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const values = yield* readJsonBody(InquiryCreate, request);
            return presentThread(yield* createMemberInquiry(user.id, values));
          }),
        failures,
      ),
    )
    .post(
      "/support/reply",
      api.route(
        InquiryThread,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { body, id } = yield* readJsonBody(InquiryReply, request);
            return presentThread(yield* replyAsMember(user.id, id, body));
          }),
        failures,
      ),
    );
}

export { supportApi };
