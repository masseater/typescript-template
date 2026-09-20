import { assert, describe, it } from "@effect/vitest";
import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect, Layer } from "effect";

import {
  auditTargetForToggle,
  editorsOnly,
  FeatureFlags,
  FLAG_KEY,
  FlagEditorAccess,
  allowAllEditors,
  memoryFeatureFlagsLayer,
} from "./index.ts";
import { toggleFlag } from "./toggle-flag.ts";

const services = Layer.mergeAll(memoryFeatureFlagsLayer, allowAllEditors, TestDatabase);

describe("FlagEditorAccess", () => {
  it.effect("rejects a viewer from editing flags", () =>
    Effect.gen(function* rejectViewer() {
      const access = yield* FlagEditorAccess.pipe(
        Effect.provide(
          Layer.mergeAll(memoryFeatureFlagsLayer, editorsOnly(new Set(["viewer-id"]))),
        ),
      );
      const flagEditorRequired = yield* access.assertEditor("viewer-id").pipe(Effect.flip);
      assert.strictEqual(flagEditorRequired._tag, "FlagEditorRequired");
    }),
  );
});

describe("toggleFlag", () => {
  it.effect("enables member-board, updates evaluation, and records an audit row", () =>
    Effect.gen(function* enableBoard() {
      const toggledFlag = yield* toggleFlag({
        actorId: "staff-actor",
        enabled: true,
        key: FLAG_KEY.memberBoard,
      });
      assert.strictEqual(toggledFlag.enabled, true);
      assert.strictEqual(toggledFlag.key, FLAG_KEY.memberBoard);

      const featureFlags = yield* FeatureFlags;
      const memberBoardEnabled = yield* featureFlags.getBoolean(FLAG_KEY.memberBoard);
      assert.strictEqual(memberBoardEnabled, true);

      const auditRows = yield* query((database) =>
        database.select().from(auditEvent).orderBy(auditEvent.createdAt),
      );
      const flagToggleAuditRow = auditRows.find(
        (auditEventRecord) => auditEventRecord.action === AUDIT_ACTION.flagToggled,
      );
      assert.isDefined(flagToggleAuditRow);
      assert.strictEqual(flagToggleAuditRow.action, AUDIT_ACTION.flagToggled);
      assert.strictEqual(flagToggleAuditRow.actorId, "staff-actor");
      assert.strictEqual(
        flagToggleAuditRow.targetId,
        auditTargetForToggle({ flagKey: FLAG_KEY.memberBoard, from: false, to: true }),
      );
    }).pipe(Effect.provide(services)),
  );
});
