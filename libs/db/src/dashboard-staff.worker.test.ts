import { assert, it } from "@effect/vitest";
import {
  APPLICATION,
  AUDIT_ACTION,
  CLIENT_KIND,
  METRIC_KEY,
  METRIC_PERIOD,
  ROLE,
  auditActions,
} from "@repo/config";
import { and, eq } from "drizzle-orm";
import { DateTime, Effect, Schema } from "effect";

import { dashboardStaff } from "./dashboard-staff.ts";
import { query } from "./database.ts";
import { bucketFor, refreshMetricSnapshots } from "./metric-snapshot.ts";
import { addUser, recordedAt } from "./records-fixture.ts";
import { auditEvent, metricSnapshot, session } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const seedMembers = Effect.gen(function* seedMembersProgram() {
  yield* addUser({ userId: "member-a" });
  yield* addUser({ userId: "member-b" });
  yield* addUser({ role: ROLE.administrator, userId: "admin-a" });
});

const seedAudit = query((database) =>
  database
    .insert(auditEvent)
    .values([
      {
        action: AUDIT_ACTION.roleChanged,
        actorId: "admin-a",
        createdAt: recordedAt,
        id: "audit-role",
        targetId: "member-a",
      },
      {
        action: AUDIT_ACTION.userDeleted,
        actorId: "admin-a",
        createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z")),
        id: "audit-delete",
        targetId: "member-b",
      },
    ])
    .then(() => undefined),
);

it.effect("aggregates member counts into daily and weekly buckets", () =>
  Effect.gen(function* program() {
    yield* seedMembers;
    yield* refreshMetricSnapshots();
    const daily = yield* dashboardStaff.metricTrend({
      days: 7,
      metric: METRIC_KEY.memberCount,
      period: METRIC_PERIOD.daily,
    });
    const weekly = yield* dashboardStaff.metricTrend({
      days: 30,
      metric: METRIC_KEY.memberCount,
      period: METRIC_PERIOD.weekly,
    });
    assert.isAtLeast(daily.length, 1);
    assert.strictEqual(daily[0]?.value, 2);
    assert.isAtLeast(weekly.length, 1);
    assert.strictEqual(weekly[0]?.value, 2);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("returns empty trends for buckets outside the requested range", () =>
  Effect.gen(function* program() {
    yield* seedMembers;
    yield* query((database) =>
      database
        .insert(metricSnapshot)
        .values({
          bucket: "1999-01-01",
          clientKind: CLIENT_KIND.total,
          computedAt: DateTime.toDate(DateTime.makeUnsafe("1999-01-01T00:00:00.000Z")),
          id: "old-snapshot",
          metric: METRIC_KEY.memberCount,
          period: "daily",
          value: 99,
        })
        .then(() => undefined),
    );
    const trend = yield* dashboardStaff.metricTrend({
      days: 7,
      metric: METRIC_KEY.memberCount,
      period: METRIC_PERIOD.daily,
    });
    assert.deepStrictEqual(trend, []);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("pages and filters audit events by actor, action, and target", () =>
  Effect.gen(function* program() {
    yield* seedMembers;
    yield* seedAudit;
    const byAction = yield* dashboardStaff.auditEvents({
      action: AUDIT_ACTION.userDeleted,
      limit: 10,
      offset: 0,
    });
    assert.strictEqual(byAction.total, 1);
    assert.strictEqual(byAction.events[0]?.action, AUDIT_ACTION.userDeleted);
    const byActor = yield* dashboardStaff.auditEvents({
      actorId: "admin-a",
      limit: 10,
      offset: 0,
    });
    assert.strictEqual(byActor.total, 2);
    const byTarget = yield* dashboardStaff.auditEvents({
      limit: 10,
      offset: 0,
      targetId: "member-a",
    });
    assert.strictEqual(byTarget.total, 1);
    const page = yield* dashboardStaff.auditEvents({ limit: 1, offset: 1 });
    assert.strictEqual(page.events.length, 1);
    assert.strictEqual(page.total, 2);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("renders every audit action literal without hard-coding the list", () =>
  Effect.gen(function* program() {
    yield* seedMembers;
    for (const action of auditActions) {
      yield* query((database) =>
        database
          .insert(auditEvent)
          .values({
            action,
            actorId: "admin-a",
            createdAt: recordedAt,
            id: `audit-${action}`,
            targetId: "member-a",
          })
          .then(() => undefined),
      );
    }
    const listed = yield* dashboardStaff.auditEvents({ limit: 20, offset: 0 });
    const actions = new Set(listed.events.map((event) => event.action));
    for (const action of auditActions) {
      assert.isTrue(actions.has(action));
    }
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("does not return personal identifiers in overview aggregates", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member-a" });
    const overview = yield* dashboardStaff.overviewWithoutPii();
    const serialized = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(overview);
    assert.notInclude(serialized, "member-a@example.com");
    assert.notInclude(serialized, '"name"');
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("classifies wiki sessions by user agent when refreshing snapshots", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "staff" });
    yield* query((database) =>
      database
        .insert(session)
        .values([
          {
            audience: APPLICATION.wiki,
            authenticationMethod: "password_totp",
            createdAt: recordedAt,
            expiresAt: DateTime.toDate(DateTime.makeUnsafe("2027-01-01T00:00:00.000Z")),
            id: "session-human",
            securityVersion: 0,
            token: "token-human",
            updatedAt: recordedAt,
            userAgent: "Mozilla/5.0",
            userId: "staff",
          },
          {
            audience: APPLICATION.wiki,
            authenticationMethod: "password_totp",
            createdAt: recordedAt,
            expiresAt: DateTime.toDate(DateTime.makeUnsafe("2027-01-01T00:00:00.000Z")),
            id: "session-ai",
            securityVersion: 0,
            token: "token-ai",
            updatedAt: recordedAt,
            userAgent: "Cursor/1.0",
            userId: "staff",
          },
        ])
        .then(() => undefined),
    );
    yield* refreshMetricSnapshots();
    const today = bucketFor(METRIC_PERIOD.daily, DateTime.toDate(DateTime.nowUnsafe()));
    const wikiSnapshots = yield* query((database) =>
      database
        .select()
        .from(metricSnapshot)
        .where(
          and(
            eq(metricSnapshot.metric, METRIC_KEY.wikiSessionCount),
            eq(metricSnapshot.bucket, today),
          ),
        ),
    );
    const human = wikiSnapshots.find((row) => row.clientKind === CLIENT_KIND.human);
    const ai = wikiSnapshots.find((row) => row.clientKind === CLIENT_KIND.ai);
    assert.strictEqual(human?.value, 1);
    assert.strictEqual(ai?.value, 1);
  }).pipe(Effect.provide(TestDatabase)),
);

it("formats daily buckets as UTC dates", () => {
  assert.strictEqual(
    bucketFor(METRIC_PERIOD.daily, DateTime.toDate(DateTime.makeUnsafe("2026-03-15T12:34:56.000Z"))),
    "2026-03-15",
  );
});
