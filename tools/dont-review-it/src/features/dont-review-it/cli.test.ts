import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { filePathOf } from "./platform/path.ts";

const NO_LOCAL_RULE = "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values";

const NO_LOCAL_CODE = "dont-review-it(no-local-finite-value-set--use-or-register-canonical-values)";

const PLUGIN_PATH = filePathOf(new URL("./plugin.ts", import.meta.url));

const PROCESS_TIMEOUT = 180_000;

const LINT_TAIL = ["--format", "json", "--threads", "1"];

const WORKSPACE_MANIFEST = JSON.stringify({
  name: "canonical-values-e2e",
  private: true,
  scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
  type: "module",
  workspaces: ["packages/*"],
});

const LINT_CONFIG_SOURCE = `export default ${JSON.stringify({
  lint: {
    categories: { correctness: "off" },
    plugins: [],
    jsPlugins: [{ name: "dont-review-it", specifier: PLUGIN_PATH }],
    rules: { [NO_LOCAL_RULE]: "error" },
  },
})};\n`;

const PACKAGE_ROUTE_FILES = {
  "package.json": WORKSPACE_MANIFEST,
  "vite.config.ts": LINT_CONFIG_SOURCE,
  "packages/vocabulary/package.json": JSON.stringify({
    name: "@fixture/vocabulary",
    private: true,
    exports: { ".": "./src/index.ts", "./alias": "./src/alias.ts", "./shadow": "./src/shadow.ts" },
  }),
  "packages/vocabulary/src/alias.ts":
    'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/owner.ts":
    '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "packages/vocabulary/src/shadow.ts":
    'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "src/alias-consumer.ts":
    'import { PUBLIC_STATUSES } from "@fixture/vocabulary/alias";\nexport const schema = z.enum(PUBLIC_STATUSES);\n',
  "src/shadow-consumer.ts":
    'import { ORDER_STATUSES } from "@fixture/vocabulary/shadow";\nexport const schema = z.enum(ORDER_STATUSES);\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@fixture/vocabulary": ["packages/vocabulary/src/index.ts"],
        "@fixture/vocabulary/*": ["packages/vocabulary/src/*"],
      },
    },
  }),
};

class LintReportUnparsable extends Schema.TaggedError<LintReportUnparsable>()(
  "LintReportUnparsable",
  { stderr: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `The lint run printed no JSON report. It wrote this to stderr:\n${this.stderr}`;
  }
}

const lintedConsumer = (consumerPath: string) =>
  Effect.gen(function* lintedConsumer() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-e2e-" });
    for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, relativePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, relativePath), fileText);
    }
    const handle = yield* spawner.spawn(
      ChildProcess.make("vp", ["lint", consumerPath, ...LINT_TAIL], {
        cwd: root,
        env: { FORCE_COLOR: "0", NO_COLOR: "1" },
        extendEnv: true,
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    ).pipe(Effect.timeout(PROCESS_TIMEOUT));
    const report = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(stdout).pipe(
      Effect.mapError((unparsable) => LintReportUnparsable.make({ stderr, cause: unparsable })),
    );
    return { exitCode, stdout, report };
  });

const messagesIn = (jsonNode: unknown): readonly string[] => {
  if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
  if (jsonNode === null || typeof jsonNode !== "object") return [];
  return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
    fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
  );
};

layer(NodeServices.layer)("canonical values oxlint plugin wiring", (it) => {
  describe("a vocabulary package exposing a shadow subpath beside an alias subpath", () => {
    describe("the consumer importing through the shadow subpath", () => {
      const fixture = Effect.gen(function* shadowConsumerLint() {
        const { exitCode, stdout, report } = yield* lintedConsumer("src/shadow-consumer.ts");
        return [
          exitCode,
          stdout.includes(NO_LOCAL_CODE),
          messagesIn(report).join("\n").includes("neither a registered public export path"),
        ];
      });

      it.effect(
        "fails the lint naming the local-value-set rule on an unregistered route",
        () =>
          Effect.gen(function* program() {
            const shadowConsumerLint = yield* fixture;
            expect(shadowConsumerLint).toStrictEqual([1, true, true]);
          }),
        PROCESS_TIMEOUT * 2,
      );
    });

    describe("the consumer importing through the alias subpath", () => {
      const fixture = Effect.map(
        lintedConsumer("src/alias-consumer.ts"),
        ({ exitCode, report }) => ({
          exitCode,
          messages: messagesIn(report),
        }),
      );

      it.effect(
        "passes the lint",
        () =>
          Effect.gen(function* program() {
            const aliasConsumerLint = yield* fixture;
            expect(aliasConsumerLint).toStrictEqual({ exitCode: 0, messages: [] });
          }),
        PROCESS_TIMEOUT * 2,
      );
    });
  });
});
