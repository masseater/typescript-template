import { httpStatus } from "@repo/config";
import { verifySession } from "@repo/auth";
import { blockMember, fileReport, unblockMember } from "@repo/db";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import { Blocked, BlockMember, ReportCreate, ReportFiled } from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...unavailable,
  TrustSubjectNotFound: {
    message: "通報する対象が見つかりません。",
    status: httpStatus.notFound,
  },
  TrustTargetUnavailable: {
    message: "対象が見つかりません。",
    status: httpStatus.notFound,
  },
};

function trustApi(api: ApiRoutes<AppServices>) {
  return createApi("/trust")
    .put(
      "/block",
      api.route(
        Blocked,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readJsonBody(BlockMember, request);
            yield* blockMember(user.id, memberId);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .delete(
      "/block",
      api.route(
        Blocked,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { memberId } = yield* readJsonBody(BlockMember, request);
            yield* unblockMember(user.id, memberId);
            return { ok: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/report",
      api.route(
        ReportFiled,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const report = yield* readJsonBody(ReportCreate, request);
            return yield* fileReport(
              user.id,
              { id: report.subjectId, kind: report.subjectKind },
              report.reason,
            );
          }),
        failures,
      ),
    );
}

export { trustApi };
