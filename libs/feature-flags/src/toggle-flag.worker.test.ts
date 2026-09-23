import { assert, describe, it } from "@effect/vitest";
import { ErrorCode, StandardResolutionReasons } from "@openfeature/server-sdk";
import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect, Layer } from "effect";

import {
  auditTargetForToggle,
  editorsOnly,
  evaluationFromDetails,
  failClosedEnabled,
  FeatureFlags,
  FLAG_EVALUATION_KIND,
  FLAG_KEY,
  FlagEditorAccess,
  allowAllEditors,
  configuredFeatureFlagsLayer,
  flagshipFeatureFlagsLayer,
  memoryFeatureFlagsLayer,
} from "./index.ts";
import { toggleFlag } from "./toggle-flag.ts";

import type { FlagshipBinding } from "@cloudflare/flagship/server";

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
  it.effect("turns member-board on then off, and records each audit row", () =>
    Effect.gen(function* toggleBoard() {
      const enabledFlag = yield* toggleFlag({
        actorId: "staff-actor",
        enabled: true,
        key: FLAG_KEY.memberBoard,
      });
      assert.strictEqual(enabledFlag.enabled, true);

      const disabledFlag = yield* toggleFlag({
        actorId: "staff-actor",
        enabled: false,
        key: FLAG_KEY.memberBoard,
      });
      assert.strictEqual(disabledFlag.enabled, false);
      assert.strictEqual(disabledFlag.key, FLAG_KEY.memberBoard);

      const featureFlags = yield* FeatureFlags;
      const memberBoardEnabled = yield* featureFlags.getBoolean(FLAG_KEY.memberBoard);
      assert.strictEqual(memberBoardEnabled, false);

      const auditRows = yield* query((database) =>
        database.select().from(auditEvent).orderBy(auditEvent.createdAt),
      );
      const flagToggleAuditRows = auditRows.filter(
        (auditEventRecord) => auditEventRecord.action === AUDIT_ACTION.flagToggled,
      );
      assert.strictEqual(flagToggleAuditRows.length, 2);
      assert.strictEqual(flagToggleAuditRows[0]?.actorId, "staff-actor");
      assert.strictEqual(
        flagToggleAuditRows[0]?.targetId,
        auditTargetForToggle({ flagKey: FLAG_KEY.memberBoard, from: false, to: true }),
      );
      assert.strictEqual(
        flagToggleAuditRows[1]?.targetId,
        auditTargetForToggle({ flagKey: FLAG_KEY.memberBoard, from: true, to: false }),
      );
    }).pipe(Effect.provide(services)),
  );
});

describe("evaluationFromDetails", () => {
  it.effect("keeps a primary targeting result", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(
        evaluationFromDetails({
          reason: StandardResolutionReasons.TARGETING_MATCH,
          value: true,
        }),
        { enabled: true, kind: FLAG_EVALUATION_KIND.evaluated },
      );
    }),
  );

  it.effect(
    "fail-closes provider errors instead of treating the OpenFeature default as enabled",
    () =>
      Effect.sync(() => {
        assert.deepStrictEqual(
          evaluationFromDetails({
            errorCode: ErrorCode.PROVIDER_NOT_READY,
            reason: StandardResolutionReasons.ERROR,
            value: true,
          }),
          { enabled: failClosedEnabled, kind: FLAG_EVALUATION_KIND.failClosed },
        );
        assert.strictEqual(failClosedEnabled, false);
      }),
  );
});

describe("flagshipFeatureFlagsLayer", () => {
  it.effect("refuses setBoolean instead of succeeding as a remote no-op", () =>
    Effect.gen(function* refuseLocalWrite() {
      const featureFlags = yield* FeatureFlags;
      const failure = yield* featureFlags.setBoolean(FLAG_KEY.memberBoard, true).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "FlagshipWriteFailed");
      assert.include(failure.detail, FLAG_KEY.memberBoard);
    }).pipe(
      Effect.provide(
        flagshipFeatureFlagsLayer({
          getBooleanDetails: (flagKey: string, defaultValue: boolean) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getBooleanValue: (_flagKey: string, defaultValue: boolean) =>
            Promise.resolve(defaultValue),
          getNumberDetails: (flagKey: string, defaultValue: number) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getNumberValue: (_flagKey: string, defaultValue: number) => Promise.resolve(defaultValue),
          getObjectDetails: (flagKey: string, defaultValue: object) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getObjectValue: (_flagKey: string, defaultValue: object) => Promise.resolve(defaultValue),
          getStringDetails: (flagKey: string, defaultValue: string) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getStringValue: (_flagKey: string, defaultValue: string) => Promise.resolve(defaultValue),
        } as FlagshipBinding),
      ),
    ),
  );

  it.effect("marks provider errors as evaluation failure and stays disabled", () =>
    Effect.gen(function* failClosedRead() {
      const featureFlags = yield* FeatureFlags;
      const evaluation = yield* featureFlags.evaluateBoolean(FLAG_KEY.memberBoard);
      assert.strictEqual(evaluation.enabled, false);
      assert.strictEqual(evaluation.kind, FLAG_EVALUATION_KIND.failClosed);
    }).pipe(
      Effect.provide(
        flagshipFeatureFlagsLayer({
          getBooleanDetails: (flagKey: string, defaultValue: boolean) =>
            Promise.resolve({
              errorCode: "PROVIDER_NOT_READY",
              errorMessage: "provider not ready",
              flagKey,
              reason: "ERROR",
              value: defaultValue,
            }),
          getBooleanValue: (_flagKey: string, defaultValue: boolean) =>
            Promise.resolve(defaultValue),
          getNumberDetails: (flagKey: string, defaultValue: number) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getNumberValue: (_flagKey: string, defaultValue: number) => Promise.resolve(defaultValue),
          getObjectDetails: (flagKey: string, defaultValue: object) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getObjectValue: (_flagKey: string, defaultValue: object) => Promise.resolve(defaultValue),
          getStringDetails: (flagKey: string, defaultValue: string) =>
            Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
          getStringValue: (_flagKey: string, defaultValue: string) => Promise.resolve(defaultValue),
        } as FlagshipBinding),
      ),
    ),
  );
});

describe("configuredFeatureFlagsLayer", () => {
  it.effect("refuses to run without Flagship outside local development", () =>
    Effect.gen(function* refuseMissingFlagship() {
      const invalid = yield* configuredFeatureFlagsLayer({ local: false }).pipe(Effect.flip);
      assert.strictEqual(invalid.reason, "FLAGS");
    }),
  );

  it.effect("serves definition defaults from memory in local development", () =>
    Effect.gen(function* localDefaults() {
      const layer = yield* configuredFeatureFlagsLayer({ local: true });
      const featureFlags = yield* FeatureFlags.pipe(Effect.provide(layer));
      const evaluation = yield* featureFlags.evaluateBoolean(FLAG_KEY.memberBoard);
      assert.strictEqual(evaluation.kind, FLAG_EVALUATION_KIND.evaluated);
    }),
  );
});
