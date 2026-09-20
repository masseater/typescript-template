import { verifySession } from "@repo/auth";
import { consumeRateLimit, recoverWithdrawnMember, withdrawMember } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  LeaveAccepted,
  LeaveRequest,
  RecoverAccepted,
  RecoverRequest,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const recoverRateLimitMax = 5;
const recoverRateLimitWindowMilliseconds = 60 * 60 * 1000;
const recoverRateLimitPrefix = "recover:";

const failures = {
  ...unavailable,
  MemberLeaveUnavailable: {
    message: "退会できません。",
    status: httpStatus.forbidden,
  },
  RecoveryExpired: {
    message: "復旧できる期間が過ぎています。",
    status: httpStatus.badRequest,
  },
  RecoveryUnavailable: {
    message: "このメールアドレスはすでに利用されています。",
    status: httpStatus.conflict,
  },
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
  RateLimitExceeded: {
    message: "しばらく待ってから再度お試しください。",
    status: httpStatus.tooManyRequests,
  },
};

function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? "anonymous";
}

const submitLeave = Effect.fn("leave.submit")(function* submitLeave(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { immediate } = yield* readJsonBody(LeaveRequest, request);
  yield* withdrawMember(user.id, { immediate });
  return { ok: true as const };
});

const submitRecover = Effect.fn("leave.recover")(function* submitRecover(request: Request) {
  const { email } = yield* readJsonBody(RecoverRequest, request);
  yield* consumeRateLimit(
    `${recoverRateLimitPrefix}${clientAddress(request.headers)}`,
    recoverRateLimitMax,
    recoverRateLimitWindowMilliseconds,
  );
  yield* recoverWithdrawnMember(email);
  return { ok: true as const };
});

function leaveApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .post("/leave", api.route(LeaveAccepted, submitLeave, failures))
    .post("/recover", api.route(RecoverAccepted, submitRecover, failures));
}

export { leaveApi };
