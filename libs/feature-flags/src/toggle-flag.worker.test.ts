import { assert, describe, it } from "@effect/vitest";
import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { auditActions } from "@repo/db/dashboard-literals";
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
      const flagEditorRequired = yield* access
        .assertEditor({ id: "viewer-id", permission: null })
        .pipe(Effect.flip);
      assert.strictEqual(flagEditorRequired._tag, "FlagEditorRequired");
    }),
  );
});

describe("toggleFlag", () => {
  it.effect("turns member-board off then on, and records each audit row", () =>
    Effect.gen(function* toggleBoard() {
      const disabledFlag = yield* toggleFlag({
        actorId: "staff-actor",
        enabled: false,
        key: FLAG_KEY.memberBoard,
      });
      assert.strictEqual(disabledFlag.enabled, false);

      const enabledFlag = yield* toggleFlag({
        actorId: "staff-actor",
        enabled: true,
        key: FLAG_KEY.memberBoard,
      });
      assert.strictEqual(enabledFlag.enabled, true);
      assert.strictEqual(enabledFlag.key, FLAG_KEY.memberBoard);

      const featureFlags = yield* FeatureFlags;
      const memberBoardEnabled = yield* featureFlags.getBoolean(FLAG_KEY.memberBoard);
      assert.strictEqual(memberBoardEnabled, true);

      const auditRows = yield* query((database) =>
        database.select().from(auditEvent).orderBy(auditEvent.createdAt),
      );
      const flagToggleAuditRows = auditRows.filter(
        (auditEventRecord) =>
          auditEventRecord.action === AUDIT_ACTION.flagToggled &&
          auditActions.includes(auditEventRecord.action),
      );
      assert.strictEqual(flagToggleAuditRows.length, 2);
      assert.strictEqual(flagToggleAuditRows[0]?.actorId, "staff-actor");
      assert.strictEqual(
        flagToggleAuditRows[0]?.targetId,
        auditTargetForToggle({ flagKey: FLAG_KEY.memberBoard, from: true, to: false }),
      );
      assert.strictEqual(
        flagToggleAuditRows[1]?.targetId,
        auditTargetForToggle({ flagKey: FLAG_KEY.memberBoard, from: false, to: true }),
      );
    }).pipe(Effect.provide(services)),
  );
});
