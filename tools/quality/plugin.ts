import { definePlugin, type RuleMeta, type Visitor } from "vite-plus/lint/plugins";

import { aliasVisitor, originVisitor } from "./alias-visitor.ts";
import { boundariesVisitor, rawD1Modules } from "./boundaries.ts";
import { effectFailuresVisitor, effectStackVisitor } from "./effect-rules.ts";
import { exampleHostGuidance, exampleValuesVisitor } from "./example-values.ts";
import { layersVisitor } from "./layers.ts";
import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { cliImplementation, processBoundaryVisitor, processMember } from "./process-boundary.ts";
import { propertyName, staticText, type Origin } from "./references.ts";
import { retiredImportsVisitor } from "./retired-imports.ts";
import { retiredImportGuidance } from "./retired-packages.ts";
import {
  gitEnvironmentVisitor,
  tempDirectoryVisitor,
  testImportGraphVisitor,
} from "./test-import-graph.ts";
import { runsInWorkerRuntime } from "./test-runtime.ts";
import { warekiFormatVisitor } from "./wareki-format.ts";

const metadata = (violation: string): RuleMeta => {
  return {
    messages: { violation },
    schema: [],
    type: "problem",
  };
};

const isEnvironment = (origin: Origin): boolean => {
  return processMember(origin) === "env";
};

const environmentVisitor = (inspection: LintContext): Visitor => {
  if (/\/(?:libs\/config|infra|tools)\//u.test(filename(inspection))) {
    return {};
  }
  return {
    ...aliasVisitor(inspection, isEnvironment),
    ExportNamedDeclaration(node: Node): void {
      if (
        node.type !== "ExportNamedDeclaration" ||
        !node.source ||
        !["node:process", "process"].includes(node.source.value)
      ) {
        return;
      }
      for (const specifier of node.specifiers) {
        const exported =
          specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
        if (exported === "env") {
          reportViolation(inspection, specifier);
        }
      }
    },
  };
};

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

const isMock = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  return mockSources.has(source ?? "") && members.some((member) => mockMethods.has(member));
};

const mockVisitor = (inspection: LintContext): Visitor => {
  return originVisitor(inspection, isMock);
};

const memoizationApis = new Set(["memo", "useCallback", "useMemo"]);

const isManualMemoization = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  return source === "react" && members.some((member) => memoizationApis.has(member));
};

const memoizationVisitor = (inspection: LintContext): Visitor => {
  return originVisitor(inspection, isManualMemoization);
};

const annotationApis = new Set([
  "annotateCurrentSpan",
  "annotateLogs",
  "annotateLogsScoped",
  "annotateSpans",
  "withLogSpan",
  "withSpan",
  "withSpanScoped",
]);
const effectModule = /^effect(?:\/|$)/u;
const observabilityAnnotations = "/libs/observability/src/annotations.ts";
const observabilitySeverity = "/libs/observability/src/severity.ts";

const isRawAnnotation = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  if (source === undefined || !effectModule.test(source)) {
    return false;
  }
  return source === "effect"
    ? members[0] === "Effect" && annotationApis.has(members[1] ?? "")
    : annotationApis.has(members[0] ?? "");
};

const annotationVisitor = (inspection: LintContext): Visitor => {
  return filename(inspection).endsWith(observabilityAnnotations)
    ? {}
    : originVisitor(inspection, isRawAnnotation);
};

const logApis = new Set([
  "log",
  "logDebug",
  "logError",
  "logFatal",
  "logInfo",
  "logTrace",
  "logWarning",
  "logWithLevel",
]);

const isRawLog = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  if (source === undefined || !effectModule.test(source)) {
    return false;
  }
  return source === "effect"
    ? members[0] === "Effect" && logApis.has(members[1] ?? "")
    : logApis.has(members[0] ?? "");
};

const logVisitor = (inspection: LintContext): Visitor => {
  return filename(inspection).endsWith(observabilitySeverity)
    ? {}
    : originVisitor(inspection, isRawLog);
};

const spanMutationApis = new Set(["attribute", "event"]);

const spanMutationVisitor = (inspection: LintContext): Visitor => {
  if (filename(inspection).endsWith(observabilityAnnotations)) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") {
        return;
      }
      const { object, property } = node.callee;
      if (object.type !== "Identifier" || !/span$/iu.test(object.name)) {
        return;
      }
      const name =
        !node.callee.computed && property.type === "Identifier"
          ? property.name
          : staticText(inspection, property);
      if (spanMutationApis.has(name ?? "")) {
        reportViolation(inspection, node.callee);
      }
    },
  };
};

const sharedWaitApis = new Set(["cached", "cachedInvalidateWithTTL", "cachedWithTTL"]);

const sharedWaitModules = new Set([
  "Cache",
  "ManagedRuntime",
  "Pool",
  "RcMap",
  "RcRef",
  "Resource",
  "ScopedCache",
]);

const isCrossRequestState = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  if (source === undefined || !effectModule.test(source)) {
    return false;
  }
  if (source !== "effect") {
    return sharedWaitApis.has(members[0] ?? "");
  }
  return (
    sharedWaitModules.has(members[0] ?? "") ||
    (members[0] === "Effect" && sharedWaitApis.has(members[1] ?? ""))
  );
};

const crossRequestStateVisitor = (inspection: LintContext): Visitor => {
  const inspected = filename(inspection);
  if (
    !runsInWorkerRuntime(inspected) ||
    inspected.endsWith("/libs/runtime/src/worker-runtime.ts")
  ) {
    return {};
  }
  return originVisitor(inspection, isCrossRequestState);
};

const workerFetchVisitor = (inspection: LintContext): Visitor => {
  if (!runsInWorkerRuntime(filename(inspection))) {
    return {};
  }
  return {
    Property(node: Node): void {
      if (
        node.type === "Property" &&
        propertyName(inspection, node) === "redirect" &&
        staticText(inspection, node.value) === "error"
      ) {
        reportViolation(inspection, node);
      }
    },
  };
};

const projectPlugin = definePlugin({
  meta: { name: "project" },
  rules: {
    annotations: {
      create: annotationVisitor,
      meta: metadata(
        "Effect.annotateLogs / annotateCurrentSpan / withSpan を直接呼べません。OTLP の logger と tracer は注釈と span 属性を fiber と span から直接読むため、logger を包んでも伏せ字が届きません。libs/observability の annotateLogs / annotateSpan / withSpan を使い、宛先へ出る属性を必ず伏せ字の規則に通してください。",
      ),
    },
    boundaries: {
      create: boundariesVisitor,
      meta: metadata(
        `依存境界違反です。配布物に入るコードの依存先は、文字列リテラルだけで指定してください。連結・テンプレート・変数の経由と require・createRequire は、依存グラフの検査が追えないので使えません。パッケージ間の向きは dependency-cruiser が tools/quality/dependency-cruiser.ts の規則で判定します。生 D1 操作は ${rawD1Modules.join(" と ")} だけに限定し、業務処理は計測付き ORM を使用してください。`,
      ),
    },
    "cross-request-state": {
      create: crossRequestStateVisitor,
      meta: metadata(
        "Worker で動くコードでは ManagedRuntime と Effect.cached 系、Cache・ScopedCache・RcRef・RcMap・Pool・Resource を使えません。どれも未完了の結果を 1 本の fiber や latch にまとめ、後から来たリクエストにそれを待たせます。待たせた継続は作った側のリクエストが終わると捨てられ、応答を返さないまま固まります。libs/runtime の workerRuntime を通してください。",
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
        `テストと fixture には実在しそうな値を書けません。ホスト名は ${exampleHostGuidance}・loopback・ドキュメント用 IP、または許可した外部サービスにしてください。UUID は 11111111-1111-4111-8111-111111111111 のように数字だけで version と variant を満たす合成値にし、hex 識別子は同一桁の繰り返しか数字だけにしてください。secret・token・password・credential・authorization などの値は大文字を含まない自己申告な文字列にしてください。`,
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
    logs: {
      create: logVisitor,
      meta: metadata(
        "Effect.log / logError / logWarning / logInfo などを直接呼べません。水準の判定を迂回すると、同じ事象が宛先によって違う厳しさで出ます。libs/observability の logAt / logCause を通してください。",
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
    "process-boundary": {
      create: processBoundaryVisitor,
      meta: metadata(
        `プロセスの入出力と終了コードを直接参照できません。別名と分割代入も同じ扱いです。標準出力と標準エラーへの書き込みは effect の Console、終了コードは @repo/config/cli の reportFailed / markFailed / exitWith、起動は同じく runCli を通してください。process.exitCode と NodeRuntime.runMain を参照できるのは ${cliImplementation} だけで、そこでも process.stdout と process.stderr は参照できません。`,
      ),
    },
    "retired-imports": {
      create: retiredImportsVisitor,
      meta: metadata(`引退した package は import できません。${retiredImportGuidance}`),
    },
    "span-mutation": {
      create: spanMutationVisitor,
      meta: metadata(
        "Tracer.Span の attribute / event を直接呼べません。OTLP の tracer は span から属性を直接読むため、伏せ字を通さない経路になります。libs/observability の annotateSpan / withSpan を使ってください。",
      ),
    },
    "temp-directory": {
      create: tempDirectoryVisitor,
      meta: metadata(
        "テストと fixture では tmpdir() の戻り値を mkdtemp / mkdtempSync に渡す以外に使えません。固定パスの一時ディレクトリは並行実行で互いの作業ディレクトリを消します。",
      ),
    },
    "test-import-graph": {
      create: testImportGraphVisitor,
      meta: metadata(
        "テストは import グラフ外のファイルに依存できません。子プロセス・ワーカーの起動、import.meta.url / process.cwd() によるパス参照、?raw などクエリ付き import をやめ、対象を import し、ファイル内容はクエリなしの import または import.meta.glob で読み込んでください。",
      ),
    },
    "wareki-format": {
      create: warekiFormatVisitor,
      meta: metadata(
        "画面に出す日付は Intl.DateTimeFormat ではなく @repo/ui の formatWarekiDate / formatWarekiMonth を使ってください。和暦と Temporal の入口を一本に保つためです。",
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

export default projectPlugin;
