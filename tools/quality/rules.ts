import type { Context, ESTree, RuleMeta, Visitor } from "@oxlint/plugins";
import { destructuredOrigins, origins, propertyName, staticText } from "./references.ts";
import { destructuresD1Operation, isD1Operation } from "./d1-references.ts";
import { importerOf, isApplicationOrLibrary, isForbiddenImport } from "./import-boundaries.ts";
import type { Origin } from "./references.ts";
import { definePlugin } from "@oxlint/plugins";

interface RawD1Checks {
  readonly destructuring: (reported: ESTree.Node, pattern: ESTree.Node, input: ESTree.Node) => void;
  readonly operation: (node: ESTree.Node) => void;
}

const mockSources = new Set([
  "vitest",
  "@vitest/spy",
  "@jest/globals",
  "jest-mock",
  "node:test",
  "test",
  "bun:test",
]);
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

function filename(context: Context): string {
  return context.filename.replaceAll("\\", "/");
}

function reportViolation(context: Context, node: ESTree.Node): void {
  context.report({ messageId: "violation", node });
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

function importSourceChecker(context: Context): (node: ESTree.Node) => void {
  const importer = importerOf(filename(context));
  return (node) => {
    const source = staticText(context, node);
    if (
      source === undefined ? isApplicationOrLibrary(importer) : isForbiddenImport(importer, source)
    ) {
      reportViolation(context, node);
    }
  };
}

function rawD1Checks(context: Context): RawD1Checks {
  const allowed = /\/libs\/db\/src\/(?:instrumentation|testing)\.ts$/u.test(filename(context));
  return {
    destructuring: (reported, pattern, input) => {
      if (!allowed && destructuresD1Operation(context, pattern, input)) {
        reportViolation(context, reported);
      }
    },
    operation: (node) => {
      if (!allowed && isD1Operation(context, node)) {
        reportViolation(context, node);
      }
    },
  };
}

function importVisitor(checkSource: (node: ESTree.Node) => void): Visitor {
  return {
    ExportAllDeclaration(node): void {
      checkSource(node.source);
    },
    ExportNamedDeclaration(node): void {
      if (node.source) {
        checkSource(node.source);
      }
    },
    ImportDeclaration(node): void {
      checkSource(node.source);
    },
    ImportExpression(node): void {
      checkSource(node.source);
    },
    TSExternalModuleReference(node): void {
      checkSource(node.expression);
    },
    TSImportType(node): void {
      checkSource(node.source);
    },
  };
}

function boundariesVisitor(context: Context): Visitor {
  const checkSource = importSourceChecker(context);
  const checks = rawD1Checks(context);
  return {
    ...importVisitor(checkSource),
    AssignmentExpression(node): void {
      checks.destructuring(node, node.left, node.right);
    },
    CallExpression(node): void {
      checks.operation(node.callee);
      const [argument] = node.arguments;
      if (
        argument !== undefined &&
        origins(context, node.callee).some(
          (origin) => origin[0] === "require" && origin.length === 1,
        )
      ) {
        checkSource(argument);
      }
    },
    MemberExpression(node): void {
      checks.operation(node);
    },
    ObjectPattern(node): void {
      if (node.typeAnnotation) {
        checks.destructuring(node, node, node.typeAnnotation);
      }
    },
    VariableDeclarator(node): void {
      if (node.init) {
        checks.destructuring(node, node.id, node.init);
      }
    },
  };
}

function aliasVisitor(context: Context, matches: (origin: Origin) => boolean): Visitor {
  function check(node: ESTree.Node): void {
    if (origins(context, node).some((origin) => matches(origin))) {
      reportViolation(context, node);
    }
  }
  return {
    AssignmentExpression(node): void {
      if (
        node.left.type === "ObjectPattern" &&
        destructuredOrigins(context, node.left, origins(context, node.right)).some((origin) =>
          matches(origin),
        )
      ) {
        reportViolation(context, node);
      }
    },
    ImportDeclaration(node): void {
      for (const specifier of node.specifiers) {
        check(specifier.local);
      }
    },
    MemberExpression: check,
    VariableDeclarator(node): void {
      if (node.id.type !== "ObjectPattern") {
        return;
      }
      for (const variable of context.sourceCode.getDeclaredVariables(node)) {
        for (const identifier of variable.identifiers) {
          check(identifier);
        }
      }
    },
  };
}

function environmentVisitor(context: Context): Visitor {
  if (/\/(?:libs\/config|infra|tools)\//u.test(filename(context))) {
    return {};
  }
  return {
    ...aliasVisitor(context, isEnvironment),
    ExportNamedDeclaration(node): void {
      if (!node.source || !["node:process", "process"].includes(node.source.value)) {
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

function mockVisitor(context: Context): Visitor {
  return {
    ...aliasVisitor(context, isMock),
    CallExpression(node): void {
      if (origins(context, node.callee).some((origin) => isMock(origin))) {
        reportViolation(context, node.callee);
      }
    },
  };
}

function workerFetchVisitor(context: Context): Visitor {
  const current = filename(context);
  if (
    !/\/(?:apps|libs|infra\/budget-monitor)\//u.test(current) ||
    /\/libs\/ui\/|\/libs\/observability\/src\/(?:sentry-)?browser\.ts$|\/libs\/runtime\/src\/client\.ts$|\/libs\/db\/src\/remote[^/]*\.ts$|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(
      current,
    )
  ) {
    return {};
  }
  return {
    Property(node): void {
      if (
        propertyName(context, node) === "redirect" &&
        staticText(context, node.value) === "error"
      ) {
        reportViolation(context, node);
      }
    },
  };
}

export default definePlugin({
  meta: { name: "project" },
  rules: {
    boundaries: {
      create: boundariesVisitor,
      meta: metadata(
        "依存境界違反です。アプリ間の参照、ユーザー側への管理者処理の持ち込み、非公開パッケージへの相対参照をやめ、公開 exports を使ってください。動的な依存先は静的な文字列で指定してください。生 DB ドライバーは libs/db 内だけで使用できます。生 D1 操作は libs/db/src/instrumentation.ts と testing.ts だけに限定し、業務処理は計測付き ORM を使用してください。公開 wiki は認証・DB・UI パッケージを参照できません。",
      ),
    },
    "environment-boundary": {
      create: environmentVisitor,
      meta: metadata(
        "環境値の直接参照は禁止です。process.env / import.meta.env は別名・分割代入も含め libs/config の検証境界へ集約してください。運用 CLI とインフラの境界では Valibot で検証してください。",
      ),
    },
    "no-internal-mocks": {
      create: mockVisitor,
      meta: metadata(
        "内部処理・関数・DB のモックは禁止です。別名や分割代入も使用できません。実 DB と実サービスで検証してください。外部 HTTP の置換だけ MSW を利用できます。",
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
