import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

const repositoryText = (file: string) =>
  Effect.gen(function* repositoryText() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    return yield* filesystem.readFileString(paths.join(repositoryRoot, file));
  }).pipe(Effect.provide(NodeServices.layer));

describe("pull request check scope", () => {
  it("runs downstream tests and import boundaries without --changed", () =>
    Effect.runPromise(
      Effect.gen(function* downstreamWithoutChanged() {
        expect.hasAssertions();
        const workflow = yield* repositoryText(".github/workflows/check.yml");
        const vite = yield* repositoryText("vite.config.ts");
        expect(workflow).toContain("vp run -r prepr");
        expect(workflow).toContain("vp run -r premerge");
        expect(workflow).toContain("pr-affected");
        expect(workflow).toContain("--fail-if-no-match");
        expect(workflow).not.toContain("--changed");
        expect(workflow).not.toContain("fetch-depth:");
        expect(workflow).not.toContain("paths-ignore");
        expect(workflow).not.toContain("paths:");
        expect(workflow).not.toMatch(/^ {6}run: vp check$/mu);
        expect(vite).toContain('premerge: ["test:dev-server", "test:storybook"]');
        expect(vite).toContain("isolate: false");
        expect(vite).toContain('name: "node-isolated"');
        expect(vite).toContain('"apps/**/*.test.ts"');
        expect(vite).toContain('"infra/**/*.test.ts"');
        expect(vite).toContain('"libs/**/*.test.ts"');
        expect(workflow).toContain("--shard=${{ matrix.shard }}/4");
        expect(workflow).toContain("shard: [1, 2, 3, 4]");
        expect(workflow).toContain("merge-queue-unit:");
        expect(workflow).toContain("merge-queue-packages:");
      }),
    ));

  it("restores the task cache from main instead of whichever cache was saved last", () =>
    Effect.runPromise(
      Effect.gen(function* taskCacheFromMain() {
        expect.hasAssertions();
        const workflows = yield* Effect.forEach(
          [".github/workflows/check.yml", ".github/workflows/load.yml"],
          repositoryText,
        );
        const restoreKeys = workflows.flatMap((workflow) =>
          [...workflow.matchAll(/restore-keys: \|\n((?: {12}.+\n)+)/gu)].flatMap(([, keys = ""]) =>
            keys.trim().split(/\n\s*/u),
          ),
        );
        expect(restoreKeys.length).toBeGreaterThan(0);
        for (const key of restoreKeys) {
          expect(key).toMatch(/-main-|github\.event\.pull_request\.base\.sha/u);
        }
        const [check = ""] = workflows;
        expect(check).toContain(
          "key: vite-task-${{ runner.os }}-${{ runner.arch }}-main-${{ github.sha }}",
        );
        expect(check).toMatch(/cache\/save@.+\n {8}if: .*steps\.affected\.outputs\./u);
        expect(check).toMatch(
          /^ {2}cache:\n {4}if: .+\n {4}runs-on: .+\n {4}timeout-minutes: 30$/mu,
        );
        expect(check).toMatch(
          /cache\/save@.+\n {8}if: \$\{\{ always\(\) && steps\.vite-task-cache\.outputs\.cache-hit != 'true' \}\}\n/u,
        );
      }),
    ));

  it("records a stuck pull-request check as a failure before the runner sits pending", () =>
    Effect.runPromise(
      Effect.gen(function* stuckCheckRecorded() {
        expect.hasAssertions();
        const workflow = yield* repositoryText(".github/workflows/check.yml");
        expect(workflow).toMatch(
          /^ {2}check-shard:\n {4}if: .+\n {4}runs-on: .+\n {4}timeout-minutes: 15$/mu,
        );
        expect(workflow).toMatch(
          /^ {2}check:\n {4}if: \$\{\{ always\(\) .+\n {4}needs: \[check-shard\]\n/mu,
        );
      }),
    ));
});
