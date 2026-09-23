import { assert, describe, it } from "@effect/vitest";
import { ErrorCode, StandardResolutionReasons } from "@openfeature/server-sdk";
import { Effect, Layer } from "effect";

import {
  editorsOnly,
  evaluationFromDetails,
  failClosedEnabled,
  FLAG_EVALUATION_KIND,
  FlagEditorAccess,
  configuredFeatureFlagsLayer,
  memoryFeatureFlagsLayer,
} from "./index.ts";

const viewerOnlyEditors = Layer.mergeAll(
  memoryFeatureFlagsLayer,
  editorsOnly(new Set(["viewer-id"])),
);

describe("FlagEditorAccess", () => {
  it.effect("rejects a viewer from editing flags", () =>
    Effect.gen(function* rejectViewer() {
      const access = yield* FlagEditorAccess.pipe(Effect.provide(viewerOnlyEditors));
      const flagEditorRequired = yield* access
        .assertEditor({ id: "viewer-id", permission: null })
        .pipe(Effect.flip);
      assert.strictEqual(flagEditorRequired._tag, "FlagEditorRequired");
    }),
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

describe("configuredFeatureFlagsLayer", () => {
  it.effect("refuses to run without Flagship outside local development", () =>
    Effect.gen(function* refuseMissingFlagship() {
      const invalid = yield* configuredFeatureFlagsLayer({ local: false }).pipe(Effect.flip);
      assert.strictEqual(invalid.reason, "FLAGS");
    }),
  );
});
