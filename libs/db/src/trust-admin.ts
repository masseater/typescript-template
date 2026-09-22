import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  AUDIT_ACTION,
  MODERATION_KIND,
  REPORT_STATUS,
  ROLE,
  type ReportStatus,
} from "@repo/config";
import { count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { DateTime, Effect } from "effect";

import { auditWhenTargeted } from "./audit.ts";
import { query } from "./database.ts";
import { user } from "./identity-schema.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";
import { AUDIT_CHANNEL } from "./schema.ts";
import { memberReport, moderationAction } from "./trust-schema.ts";
import { TrustSubjectNotFound, TrustTargetUnavailable } from "./trust.ts";

const targetUser = alias(user, "report_target");
const reporterUser = alias(user, "report_reporter");
const clockDate = Effect.map(DateTime.now, DateTime.toDate);

function matchesStatus(status: ReportStatus | undefined) {
  return status === undefined ? undefined : eq(memberReport.status, status);
}

const listReports = Effect.fn("listReports")(function* listReports(
  sessionId: string,
  page: { readonly limit: number; readonly offset: number; readonly status?: ReportStatus },
) {
  yield* requireAdmin(sessionId);
  const rows = yield* query((database) =>
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
  const [total] = yield* query((database) =>
    database.select({ count: count() }).from(memberReport).where(matchesStatus(page.status)),
  );
  return {
    reports: rows.map((row) => ({
      createdAt: row.createdAt.getTime(),
      id: row.id,
      reason: row.reason,
      reporterName: row.reporterName,
      status: row.status,
      targetName: row.targetName,
    })),
    total: total?.count ?? 0,
  };
});

const readReport = Effect.fn("readReport")(function* readReport(
  sessionId: string,
  reportId: string,
) {
  yield* requireAdmin(sessionId);
  const [row] = yield* query((database) =>
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
  if (row === undefined) {
    return yield* new TrustSubjectNotFound();
  }
  const targetMemberId = row.targetMemberId;
  const target =
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
    body: row.body,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    reason: row.reason,
    reporterId: row.reporterId,
    reporterName: row.reporterName,
    status: row.status,
    targetEmail: target === undefined ? null : target.email,
    targetMemberId: row.targetMemberId,
    targetName: target === undefined ? null : target.name,
    targetSuspended: target?.accountState === ACCOUNT_STATE.suspended,
  };
});

const suspendTarget = Effect.fn("suspendTarget")(function* suspendTarget(
  sessionId: string,
  reportId: string,
  suspended: boolean,
) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [report] = yield* query((database) =>
    database
      .select({ targetMemberId: memberReport.targetMemberId })
      .from(memberReport)
      .where(eq(memberReport.id, reportId))
      .limit(1),
  );
  if (report?.targetMemberId == null) {
    return yield* new TrustTargetUnavailable();
  }
  const targetId = report.targetMemberId;
  const now = yield* clockDate;
  const accountState = suspended ? ACCOUNT_STATE.suspended : ACCOUNT_STATE.active;
  const action = suspended ? AUDIT_ACTION.memberSuspended : AUDIT_ACTION.memberUnsuspended;
  const [, updated] = yield* query((database) => {
    const live = liveAdmin(database, sessionId, now, ADMIN_PERMISSION.operator);
    const audit = database.run(
      auditWhenTargeted(
        database,
        {
          action,
          actorId: actor.user.id,
          actorKind: ROLE.administrator,
          channel: AUDIT_CHANNEL.ui,
          targetId,
        },
        live,
      ),
    );
    const suspension = database
      .update(user)
      .set({ accountState, updatedAt: now })
      .where(eq(user.id, targetId))
      .returning({ id: user.id });
    const moderation = database.insert(moderationAction).values({
      actorId: actor.user.id,
      createdAt: now,
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
  if (updated.length === 0) {
    return yield* new TrustTargetUnavailable();
  }
});

const warnTarget = Effect.fn("warnTarget")(function* warnTarget(
  sessionId: string,
  reportId: string,
) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [report] = yield* query((database) =>
    database
      .select({ targetMemberId: memberReport.targetMemberId })
      .from(memberReport)
      .where(eq(memberReport.id, reportId))
      .limit(1),
  );
  if (report === undefined) {
    return yield* new TrustSubjectNotFound();
  }
  const now = yield* clockDate;
  yield* query((database) =>
    database.batch([
      database.insert(moderationAction).values({
        actorId: actor.user.id,
        createdAt: now,
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
  const updated = yield* query((database) =>
    database
      .update(memberReport)
      .set({ status: REPORT_STATUS.dismissed })
      .where(eq(memberReport.id, reportId))
      .returning({ id: memberReport.id }),
  );
  if (updated.length === 0) {
    return yield* new TrustSubjectNotFound();
  }
});

export { dismissReport, listReports, readReport, suspendTarget, warnTarget };
