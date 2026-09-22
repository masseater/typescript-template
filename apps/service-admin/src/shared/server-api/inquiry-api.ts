import { httpStatus } from "@repo/config";
import { verifySession } from "@repo/auth";
import {
  closeInquiry,
  countPendingInquiries,
  getAdminInquiry,
  getInquiryMemberSummary,
  listAdminInquiries,
  replyAsAdmin,
} from "@repo/db";
import { privileged } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AdminInquiryList,
  AdminInquiryThread,
  InquiryClose,
  InquiryListQuery,
  InquiryMemberSummary,
  InquiryQuery,
  InquiryReply,
  MemberQuery,
  PendingCount,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...privileged,
  InquiryForbidden: { message: "この問い合わせには返信できません。", status: httpStatus.conflict },
  InquiryNotFound: { message: "問い合わせが見つかりません。", status: httpStatus.notFound },
};

const sessionOf = Effect.fn("sessionOf")(function* sessionOf(request: Request) {
  const { session } = yield* verifySession(request.headers);
  return session.id;
});

const listInquiries = Effect.fn("listInquiries")(function* listInquiries(request: Request) {
  const sessionId = yield* sessionOf(request);
  const page = yield* readSearchParams(InquiryListQuery, request);
  return yield* listAdminInquiries(sessionId, page);
});

const pendingCount = Effect.fn("pendingCount")(function* pendingCount(request: Request) {
  const count = yield* countPendingInquiries(yield* sessionOf(request));
  return { count };
});

const inquiryDetail = Effect.fn("inquiryDetail")(function* inquiryDetail(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readSearchParams(InquiryQuery, request);
  return yield* getAdminInquiry(sessionId, id);
});

const memberSummary = Effect.fn("memberSummary")(function* memberSummary(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readSearchParams(MemberQuery, request);
  return yield* getInquiryMemberSummary(sessionId, id);
});

const reply = Effect.fn("reply")(function* reply(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { body, id } = yield* readJsonBody(InquiryReply, request);
  return yield* replyAsAdmin(sessionId, id, body);
});

const close = Effect.fn("close")(function* close(request: Request) {
  const sessionId = yield* sessionOf(request);
  const { id } = yield* readJsonBody(InquiryClose, request);
  return yield* closeInquiry(sessionId, id);
});

function inquiryApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .get("/inquiries", api.route(AdminInquiryList, listInquiries, failures))
    .get("/inquiries/pending-count", api.route(PendingCount, pendingCount, failures))
    .get("/inquiries/detail", api.route(AdminInquiryThread, inquiryDetail, failures))
    .get("/inquiries/member", api.route(InquiryMemberSummary, memberSummary, failures))
    .post("/inquiries/reply", api.route(AdminInquiryThread, reply, failures))
    .post("/inquiries/close", api.route(AdminInquiryThread, close, failures));
}

export { inquiryApi };
