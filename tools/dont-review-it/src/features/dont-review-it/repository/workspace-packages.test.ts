import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { affectedTests } from "./pr-affected-scope.ts";
import { workspacePackages } from "./workspace-packages.ts";

layer(NodeServices.layer)("workspacePackages", (it) => {
  describe("the workspaces whose toolchain config loads the test telemetry library", () => {
    const telemetryChange = Effect.map(workspacePackages, (packages) =>
      affectedTests(["libs/telemetry/src/features/telemetry/vitest-sdk.ts"], packages),
    );

    it.effect("are affected by a change to that library although it cannot be declared", () =>
      Effect.gen(function* program() {
        const affected = yield* telemetryChange;
        expect(affected.kind === "subset" ? affected.directories : []).toStrictEqual(
          expect.arrayContaining(["libs/cli", "libs/config", "libs/telemetry", "libs/vite-config"]),
        );
      }),
    );
  });
});
