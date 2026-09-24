import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  AUDIT_ACTION,
  MODERATION_KIND,
  REPORT_STATUS,
  ROLE,
  type ReportStatus,
} from "@repo/config";
import { desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Effect } from "effect";

import { auditWhenTargeted } from "./audit.ts";
import { clockDate } from "./clock-date.ts";
import { countRows } from "./count-rows.ts";
import { query } from "./database.ts";
import { user } from "./identity-schema.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";
import { AUDIT_CHANNEL } from "./schema.ts";
import { memberReport, moderationAction } from "./trust-schema.ts";
import { TrustSubjectNotFound } from "./trust-subject-not-found.ts";
import { TrustTargetUnavailable } from "./trust-target-unavailable.ts";

const targetUser = alias(user, "report_target");
const reporterUser = alias(user, "report_reporter");

const reportTarget = Effect.fn("reportTarget")(function* reportTarget(reportId: string) {
  return yield* query((database) =>
    database
      .select({ targetMemberId: memberReport.targetMemberId })
      .from(memberReport)
      .where(eq(memberReport.id, reportId))
      .limit(1),
  );
});

const matchesStatus = (reportStatus: ReportStatus | undefined): SQL | undefined =>
  reportStatus === undefined ? undefined : eq(memberReport.status, reportStatus);

const listReports = Effect.fn("listReports")(function* listReports(
  sessionId: string,
  page: { readonly limit: number; readonly offset: number; readonly status?: ReportStatus },
) {
  yield* requireAdmin(sessionId);
  const listedReports = yield* query((database) =>
    database
      .select({
        createdAt: memberReport.createdAt,
        id: memberReport.id,
        reason: memberReport.reason,
        reporterName: reporterUser.name,
        status: memberReport.status,
        targetName: targetUser.name,
      })
      .from(memberReport)
      .leftJoin(reporterUser, eq(reporterUser.id, memberReport.reporterId))
      .leftJoin(targetUser, eq(targetUser.id, memberReport.targetMemberId))
      .where(matchesStatus(page.status))
      .orderBy(desc(memberReport.createdAt), desc(memberReport.id))
      .limit(page.limit)
      .offset(page.offset),
  );
  const matchingCount = yield* countRows(memberReport, () => matchesStatus(page.status));
  return {
    reports: listedReports.map((listedReport) => ({
      createdAt: listedReport.createdAt.getTime(),
      id: listedReport.id,
      reason: listedReport.reason,
      reporterName: listedReport.reporterName,
      status: listedReport.status,
      targetName: listedReport.targetName,
    })),
    total: matchingCount,
  };
});

const readReport = Effect.fn("readReport")(function* readReport(
  sessionId: string,
  reportId: string,
) {
  yield* requireAdmin(sessionId);
  const [report] = yield* query((database) =>
    database
      .select({
        body: memberReport.body,
        createdAt: memberReport.createdAt,
        id: memberReport.id,
        reason: memberReport.reason,
        reporterId: memberReport.reporterId,
        reporterName: reporterUser.name,
        status: memberReport.status,
        targetMemberId: memberReport.targetMemberId,
      })
      .from(memberReport)
      .leftJoin(reporterUser, eq(reporterUser.id, memberReport.reporterId))
      .where(eq(memberReport.id, reportId))
      .limit(1),
  );
  if (report === undefined) {
    return yield* new TrustSubjectNotFound();
  }
  const targetMemberId = report.targetMemberId;
  const targetMember =
    targetMemberId === null
      ? undefined
      : (yield* query((database) =>
          database
            .select({
              accountState: user.accountState,
              email: user.email,
              name: user.name,
            })
            .from(user)
            .where(eq(user.id, targetMemberId))
            .limit(1),
        ))[0];
  const actions = yield* query((database) =>
    database
      .select({
        createdAt: moderationAction.createdAt,
        id: moderationAction.id,
        kind: moderationAction.kind,
      })
      .from(moderationAction)
      .where(eq(moderationAction.reportId, reportId))
      .orderBy(moderationAction.createdAt, moderationAction.id),
  );
  return {
    actions: actions.map((action) => ({
      createdAt: action.createdAt.getTime(),
      id: action.id,
      kind: action.kind,
    })),
    body: report.body,
    createdAt: report.createdAt.getTime(),
    id: report.id,
    reason: report.reason,
    reporterId: report.reporterId,
    reporterName: report.reporterName,
    status: report.status,
    targetEmail: targetMember === undefined ? null : targetMember.email,
    targetMemberId: report.targetMemberId,
    targetName: targetMember === undefined ? null : targetMember.name,
    targetSuspended: targetMember?.accountState === ACCOUNT_STATE.suspended,
  };
});

const suspendTarget = Effect.fn("suspendTarget")(function* suspendTarget({
  reportId,
  sessionId,
  suspended,
}: {
  readonly reportId: string;
  readonly sessionId: string;
  readonly suspended: boolean;
}) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [report] = yield* reportTarget(reportId);
  const targetId = report?.targetMemberId;
  if (targetId === undefined || targetId === null) {
    return yield* new TrustTargetUnavailable();
  }
  const suspendedAt = yield* clockDate;
  const [, suspendedMembers] = yield* query((database) => {
    const live = liveAdmin(database, {
      checkedAt: suspendedAt,
      required: ADMIN_PERMISSION.operator,
      sessionId,
    });
    const audit = database.run(
      auditWhenTargeted(database, {
        actorIsLive: live,
        entry: {
          action: suspended ? AUDIT_ACTION.memberSuspended : AUDIT_ACTION.memberUnsuspended,
          actorId: actor.user.id,
          actorKind: ROLE.administrator,
          channel: AUDIT_CHANNEL.ui,
          targetId,
        },
      }),
    );
    const suspension = database
      .update(user)
      .set({
        accountState: suspended ? ACCOUNT_STATE.suspended : ACCOUNT_STATE.active,
        updatedAt: suspendedAt,
      })
      .where(eq(user.id, targetId))
      .returning({ id: user.id });
    const moderation = database.insert(moderationAction).values({
      actorId: actor.user.id,
      createdAt: suspendedAt,
      id: crypto.randomUUID(),
      kind: suspended ? MODERATION_KIND.suspend : MODERATION_KIND.unsuspend,
      reportId,
      targetMemberId: targetId,
    });
    const filed = database
      .update(memberReport)
      .set({ status: REPORT_STATUS.actioned })
      .where(eq(memberReport.id, reportId));
    return database.batch([audit, suspension, moderation, filed] as const);
  });
  if (suspendedMembers.length === 0) {
    return yield* new TrustTargetUnavailable();
  }
});

const warnTarget = Effect.fn("warnTarget")(function* warnTarget(
  sessionId: string,
  reportId: string,
) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [report] = yield* reportTarget(reportId);
  if (report === undefined) {
    return yield* new TrustSubjectNotFound();
  }
  const warnedAt = yield* clockDate;
  yield* query((database) =>
    database.batch([
      database.insert(moderationAction).values({
        actorId: actor.user.id,
        createdAt: warnedAt,
        id: crypto.randomUUID(),
        kind: MODERATION_KIND.warn,
        reportId,
        targetMemberId: report.targetMemberId,
      }),
      database
        .update(memberReport)
        .set({ status: REPORT_STATUS.actioned })
        .where(eq(memberReport.id, reportId)),
    ]),
  );
});

const dismissReport = Effect.fn("dismissReport")(function* dismissReport(
  sessionId: string,
  reportId: string,
) {
  yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const dismissedReports = yield* query((database) =>
    database
      .update(memberReport)
      .set({ status: REPORT_STATUS.dismissed })
      .where(eq(memberReport.id, reportId))
      .returning({ id: memberReport.id }),
  );
  if (dismissedReports.length === 0) {
    return yield* new TrustSubjectNotFound();
  }
});

export { dismissReport, listReports, readReport, suspendTarget, warnTarget };
