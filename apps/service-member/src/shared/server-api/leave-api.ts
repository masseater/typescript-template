import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { acceptRecovery, declineRecovery, findRecoveryOffer, withdrawMember } from "@repo/db";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  LeaveAccepted,
  LeaveRequest,
  RecoveryAccepted,
  RecoveryOfferView,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

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
    message: "復旧できません。",
    status: httpStatus.conflict,
  },
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
};

const submitLeave = Effect.fn("leave.submit")(function* submitLeave(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { immediate } = yield* readJsonBody(LeaveRequest, request);
  yield* withdrawMember(user.id, { immediate });
  return { ok: true as const };
});

const loadRecoveryOffer = Effect.fn("leave.recoveryOffer")(function* loadRecoveryOffer(
  request: Request,
) {
  const { user } = yield* verifySession(request.headers);
  return yield* findRecoveryOffer(user.id);
});

const submitRecoveryAccept = Effect.fn("leave.recoveryAccept")(function* submitRecoveryAccept(
  request: Request,
) {
  const { user } = yield* verifySession(request.headers);
  yield* acceptRecovery(user.id);
  return { ok: true as const };
});

const submitRecoveryDecline = Effect.fn("leave.recoveryDecline")(function* submitRecoveryDecline(
  request: Request,
) {
  const { user } = yield* verifySession(request.headers);
  yield* declineRecovery(user.id);
  return { ok: true as const };
});

function leaveApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .post("/leave", api.route(LeaveAccepted, submitLeave, failures))
    .get("/recovery-offer", api.route(RecoveryOfferView, loadRecoveryOffer, failures))
    .post("/recovery/accept", api.route(RecoveryAccepted, submitRecoveryAccept, failures))
    .post("/recovery/decline", api.route(RecoveryAccepted, submitRecoveryDecline, failures));
}

export { leaveApi };
