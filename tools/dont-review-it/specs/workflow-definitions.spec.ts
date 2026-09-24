import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { runChecks } from "../src/features/dont-review-it/run-checks.ts";

const WORKFLOW_PATH = ".github/workflows/ci.yml";

const RENOVATE_PATH = "renovate.json";

const PINNED_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-workflows-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([fileName, source]) =>
        Effect.gen(function* writeFixture() {
          const absolutePath = paths.join(repositoryRoot, fileName);
          yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
          yield* filesystem.writeFileString(absolutePath, source);
        }),
      { discard: true },
    );
    return repositoryRoot;
  });

const reportedForWorkflow = (workflowSource: string) =>
  Effect.gen(function* reportedForWorkflow() {
    const repositoryRoot = yield* repositoryWith({ [WORKFLOW_PATH]: workflowSource });
    const { problems } = yield* runChecks(repositoryRoot);
    return problems.join("\n");
  });

layer(NodeServices.layer)("ワークフロー定義の検査", (it) => {
  it.effect("解釈できない定義を、どの検査も素通りする前に場所を指して報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow("on: [pull_request\n");
      expect(reported).toContain(`${WORKFLOW_PATH}:`);
      expect(reported).toContain("must not stay in the repository");
    }),
  );

  it.effect(
    "ゲートとして要求されうるトリガが、自分の起動をパスやブランチで絞り込んでいたら報告する",
    () =>
      Effect.gen(function* program() {
        const reported = yield* reportedForWorkflow(`on:
  pull_request:
    paths: [src/**]
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
        expect(reported).toContain("must not narrow its own start");
      }),
  );

  it.effect("呼び出される部品が、自分を起動するトリガを併せ持っていたら報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  workflow_call:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
      expect(reported).toContain("must not own a trigger of its own");
    }),
  );

  it.effect("別のワークフローの結果を受けて起動する連鎖を報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  workflow_run:
    workflows: [CI]
    types: [completed]
permissions:
  contents: read
jobs:
  after:
    steps:
      - run: vp run deploy
`);
      expect(reported).toContain("must not be split across runs");
    }),
  );

  it.effect("権限を宣言しないまま既定の権限で走るジョブを報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
jobs:
  ready:
    steps:
      - run: vp run guard
`);
      expect(reported).toContain("Declare permissions");
    }),
  );

  it.effect("1 つの実行ブロックに複数のコマンド呼び出しを詰めたステップを報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp install && vp run guard
`);
      expect(reported).toContain("must not hold more than one command call");
    }),
  );

  it.effect("失敗を握りつぶす記述を実行ブロックに置けない", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard || true
`);
      expect(reported).toContain("must not be swallowed inside a run block");
    }),
  );

  it.effect("タグで参照したアクションを報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@v5
`);
      expect(reported).toContain("must not end in a tag or a branch");
    }),
  );

  it.effect("固定はしたが版を書き添えていないアクション参照を報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA}
`);
      expect(reported).toContain("must not stand without the version it pins");
    }),
  );

  it.effect("履歴を全部取りにいくチェックアウトを報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA} # v5
        with:
          fetch-depth: 0
`);
      expect(reported).toContain("must not ask for the whole history");
    }),
  );

  it.effect("固定した参照を引き上げる仕組みを持たないリポジトリを報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
      expect(reported).toContain("must not leave the pins without");
    }),
  );

  it.effect("失敗を成功として報告させる continue-on-error を置けない", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    continue-on-error: true
    steps:
      - run: vp run guard
`);
      expect(reported).toContain("must not be reported as a pass");
    }),
  );

  it.effect("すべての規律を守った定義を黙って通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        [RENOVATE_PATH]: `{}\n`,
        [WORKFLOW_PATH]: `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA} # v5
      - run: vp run guard
`,
      });
      const { problems, warnings, failures } = yield* runChecks(repositoryRoot);

      expect(problems).toStrictEqual([]);
      expect(warnings).toStrictEqual([]);
      expect(failures).toStrictEqual([]);
    }),
  );
});
