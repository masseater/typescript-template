import type { RuleMeta, Visitor } from "vite-plus/lint/plugins";
import { definePlugin } from "vite-plus/lint/plugins";

import { aliasVisitor, originVisitor } from "./alias-visitor.ts";
import { boundariesVisitor, rawD1Modules } from "./boundaries.ts";
import { effectFailuresVisitor, effectStackVisitor } from "./effect-rules.ts";
import { exampleLabels, exampleValuesVisitor } from "./example-values.ts";
import { layersVisitor } from "./layers.ts";
import type { LintContext, Node } from "./lint-context.ts";
import { filename, reportViolation } from "./lint-context.ts";
import { propertyName, staticText } from "./references.ts";
import type { Origin } from "./references.ts";
import { gitEnvironmentVisitor, testImportGraphVisitor } from "./test-import-graph.ts";
import { runsInWorkerRuntime } from "./test-runtime.ts";

const mockSources = new Set([
  "vitest",
  "@vitest/spy",
  "vite-plus/test",
  "vite-plus/test/plugins/spy",
  "@jest/globals",
  "jest-mock",
  "node:test",
  "test",
  "bun:test",
]);
const memoizationApis = new Set(["memo", "useCallback", "useMemo"]);
const annotationApis = new Set([
  "annotateCurrentSpan",
  "annotateLogs",
  "annotateLogsScoped",
  "annotateSpans",
  "withLogSpan",
]);
const effectModule = /^effect(?:\/|$)/u;
const mockMethods = new Set([
  "mock",
  "doMock",
  "fn",
  "spyOn",
  "stubGlobal",
  "stubEnv",
  "mockObject",
  "mockModule",
]);

function metadata(message: string): RuleMeta {
  return {
    messages: { violation: message },
    schema: [],
    type: "problem",
  };
}

function isMock(origin: Origin): boolean {
  const [source, ...members] = origin;
  return mockSources.has(source ?? "") && members.some((member) => mockMethods.has(member));
}

function isEnvironment(origin: Origin): boolean {
  const [source, ...members] = origin;
  return (
    ((source === "node:process" || source === "process" || source === "import.meta") &&
      members[0] === "env") ||
    (source === "global" && members[0] === "process" && members[1] === "env")
  );
}

function environmentVisitor(context: LintContext): Visitor {
  if (/\/(?:libs\/config|infra|tools)\//u.test(filename(context))) {
    return {};
  }
  return {
    ...aliasVisitor(context, isEnvironment),
    ExportNamedDeclaration(node: Node): void {
      if (
        node.type !== "ExportNamedDeclaration" ||
        !node.source ||
        !["node:process", "process"].includes(node.source.value)
      ) {
        return;
      }
      for (const specifier of node.specifiers) {
        const name =
          specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
        if (name === "env") {
          reportViolation(context, specifier);
        }
      }
    },
  };
}

function mockVisitor(context: LintContext): Visitor {
  return originVisitor(context, isMock);
}

function isManualMemoization(origin: Origin): boolean {
  const [source, ...members] = origin;
  return source === "react" && members.some((member) => memoizationApis.has(member));
}

function memoizationVisitor(context: LintContext): Visitor {
  return originVisitor(context, isManualMemoization);
}

function isRawAnnotation(origin: Origin): boolean {
  const [source, ...members] = origin;
  if (source === undefined || !effectModule.test(source)) {
    return false;
  }
  return source === "effect"
    ? members[0] === "Effect" && annotationApis.has(members[1] ?? "")
    : annotationApis.has(members[0] ?? "");
}

function annotationVisitor(context: LintContext): Visitor {
  return filename(context).endsWith("/libs/observability/src/annotations.ts")
    ? {}
    : originVisitor(context, isRawAnnotation);
}

function workerFetchVisitor(context: LintContext): Visitor {
  if (!runsInWorkerRuntime(filename(context))) {
    return {};
  }
  return {
    Property(node: Node): void {
      if (
        node.type === "Property" &&
        propertyName(context, node) === "redirect" &&
        staticText(context, node.value) === "error"
      ) {
        reportViolation(context, node);
      }
    },
  };
}

// oxlint-disable-next-line import/no-default-export
export default definePlugin({
  meta: { name: "project" },
  rules: {
    annotations: {
      create: annotationVisitor,
      meta: metadata(
        "Effect.annotateLogs と Effect.annotateCurrentSpan を直接呼べません。OTLP の logger と tracer は注釈と span 属性を fiber と span から直接読むため、logger を包んでも伏せ字が届きません。libs/observability の annotateLogs / annotateSpan を使い、宛先へ出る属性を必ず伏せ字の規則に通してください。",
      ),
    },
    boundaries: {
      create: boundariesVisitor,
      meta: metadata(
        `依存境界違反です。配布物に入るコードの依存先は、文字列リテラルだけで指定してください。連結・テンプレート・変数の経由と require・createRequire は、依存グラフの検査が追えないので使えません。パッケージ間の向きは dependency-cruiser が tools/quality/dependency-cruiser.ts の規則で判定します。生 D1 操作は ${rawD1Modules.join(" と ")} だけに限定し、業務処理は計測付き ORM を使用してください。`,
      ),
    },
    "effect-failures": {
      create: effectFailuresVisitor,
      meta: metadata(
        "effect を使うファイルでは throw と try/catch を使えません。失敗は Schema.TaggedError で型に載せ、Effect.fail・Effect.try・Effect.tryPromise・Result.try で扱ってください。better-auth のフックが要求する APIError だけは throw できます。",
      ),
    },
    "effect-stack": {
      create: effectStackVisitor,
      meta: metadata(
        "入力検証は valibot ではなく effect の Schema で行ってください。Elysia アプリは libs/runtime/src/http.ts の createApi で作り、createFileRoute の server には elysiaServer(app) だけを渡して Elysia に委譲してください。handlers を直接書いた server route は作れません。",
      ),
    },
    "environment-boundary": {
      create: environmentVisitor,
      meta: metadata(
        "環境値の直接参照は禁止です。process.env / import.meta.env は別名・分割代入も含め libs/config の検証境界へ集約してください。運用 CLI とインフラの境界では Effect の Schema で検証してください。",
      ),
    },
    "example-values": {
      create: exampleValuesVisitor,
      meta: metadata(
        `テストと fixture には実在しそうな値を書けません。ホスト名は ${exampleLabels.join(" / ")} のいずれかのラベルを含む例示ドメインか loopback にし、UUID は 11111111-1111-4111-8111-111111111111 のように数字だけで version と variant を満たす合成値にし、secret・token・password・credential の値は大文字を含まない自己申告な文字列にしてください。`,
      ),
    },
    "git-environment": {
      create: gitEnvironmentVisitor,
      meta: metadata(
        "テストと fixture から git を起動するときは env を明示してください。継承した GIT_DIR・GIT_INDEX_FILE・GIT_WORK_TREE を持ったままの git init・git config・git add は、一時ディレクトリではなくこのリポジトリの設定と index を書き換えます。",
      ),
    },
    layers: {
      create: layersVisitor,
      meta: metadata(
        "Feature-Sliced Design のアプリでは、src の直下に置けるのは app・pages・widgets・features・entities・shared の各レイヤーだけです。ファイルをいずれかのレイヤーのスライスかセグメントへ移してください。レイヤーの外は steiger の検査が届きません。",
      ),
    },
    "no-internal-mocks": {
      create: mockVisitor,
      meta: metadata(
        "内部処理・関数・DB のモックは禁止です。別名や分割代入も使用できません。実 DB と実サービスで検証してください。外部 HTTP の置換だけ MSW を利用できます。",
      ),
    },
    "no-manual-memoization": {
      create: memoizationVisitor,
      meta: metadata(
        "手作業のメモ化は禁止です。React Compiler が最適化するので useMemo・useCallback・React.memo は別名や分割代入も含めて使わず、素の値と関数宣言のまま書いてください。",
      ),
    },
    "test-import-graph": {
      create: testImportGraphVisitor,
      meta: metadata(
        "テストは import グラフ外のファイルに依存できません。子プロセス・ワーカーの起動、import.meta.url / process.cwd() によるパス参照、?raw などクエリ付き import をやめ、対象を import し、ファイル内容はクエリなしの import または import.meta.glob で読み込んでください。",
      ),
    },
    "worker-fetch": {
      create: workerFetchVisitor,
      meta: metadata(
        'Cloudflare Workers の fetch は redirect: "error" を実行時に拒否します。Worker で動くコードでは redirect: "manual" を指定し、3xx を失敗として扱ってください。ブラウザ・Node 専用のファイルだけで "error" を使えます。',
      ),
    },
  },
});
