import path from "node:path";
import { definePlugin } from "vite-plus/lint/plugins";
import type { Context, RuleMeta, ESTree } from "vite-plus/lint/plugins";
import {
  destructuredOrigins,
  origins,
  staticText,
  isD1Operation,
  destructuresD1Operation,
} from "./references.ts";
import type { Origin } from "./references.ts";

const metadata = (message: string): RuleMeta => ({
  type: "problem",
  schema: [],
  messages: { violation: message },
});
const filename = (context: Context) => context.filename.replaceAll("\\", "/");
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
const isMock = (origin: Origin) => {
  const [source, ...members] = origin;
  if (
    ![
      "vitest",
      "@vitest/spy",
      "vite-plus/test",
      "vite-plus/test/plugins/spy",
      "@jest/globals",
      "jest-mock",
      "node:test",
      "test",
      "bun:test",
    ].includes(source ?? "")
  )
    return false;
  return members.some((member) => mockMethods.has(member));
};
const isEnvironment = (origin: Origin) => {
  const [source, ...members] = origin;
  return (
    ((source === "node:process" || source === "process" || source === "import.meta") &&
      members[0] === "env") ||
    (source === "global" && members[0] === "process" && members[1] === "env")
  );
};

export default definePlugin({
  meta: { name: "project" },
  rules: {
    boundaries: {
      meta: metadata(
        "依存境界違反です。アプリ間の参照、ユーザー側への管理者処理の持ち込み、非公開パッケージへの相対参照をやめ、公開 exports を使ってください。動的な依存先は静的な文字列で指定してください。生 DB ドライバーは libs/db 内だけで使用できます。生 D1 操作は libs/db/src/instrumentation.ts と testing.ts だけに限定し、業務処理は計測付き ORM を使用してください。wiki はローカル D1 の定義以外の DB パッケージを直接参照できず、利用者登録の画面も持てません。",
      ),
      create(context) {
        const current = filename(context);
        const rawD1Allowed = /\/libs\/db\/src\/(?:instrumentation|testing)\.ts$/.test(current);
        const checkD1 = (node: ESTree.Node) => {
          if (!rawD1Allowed && isD1Operation(context, node))
            context.report({ node, messageId: "violation" });
        };
        const location = current.match(/^(.*?)\/(apps|libs|tools|infra)\/([^/]+)\//);
        const root = location?.[1];
        const area = location?.[2];
        const owner = location?.[3];
        const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(current);
        function check(node: ESTree.Node) {
          const source = staticText(context, node);
          if (source === undefined) {
            if (area === "apps" || area === "libs")
              context.report({ node, messageId: "violation" });
            return;
          }
          const clean = source.replaceAll("\\", "/").split(/[?#]/)[0] ?? source;
          const relative = clean.startsWith(".") || path.isAbsolute(clean);
          const resolved = relative
            ? path.resolve(path.dirname(current), clean).replaceAll("\\", "/")
            : clean;
          const target = resolved.match(/\/(apps|libs|tools|infra)\/([^/]+)(?:\/|$)/);
          const namedApp = clean.match(/^@template\/(user|admin|wiki)(?:\/|$)/)?.[1];
          const targetApp = target?.[1] === "apps" ? target[2] : namedApp;
          const dbAdmin =
            /^@template\/db\/(?:src\/)?admin(?:[/.]|$)/.test(clean) ||
            /\/libs\/db\/(?:src\/)?admin(?:[/.]|$)/.test(resolved);
          const dbOperations =
            /^@template\/db\/(?:src\/)?(?:remote[^/]*|bootstrap[^/]*|testing)(?:[/.]|$)/.test(
              clean,
            ) ||
            /\/libs\/db\/(?:src\/)?(?:remote[^/]*|bootstrap[^/]*|testing)(?:[/.]|$)/.test(resolved);
          const withinDb = area === "libs" && owner === "db";
          const dbRoot = withinDb && /\/src\/index\.[cm]?[jt]s$/.test(current);
          const packageEscape =
            relative &&
            root !== undefined &&
            (area === "apps" || area === "libs") &&
            !resolved.startsWith(`${root}/${area}/${owner}/`);
          const forbidden =
            ((area === "libs" || (area === "apps" && owner !== targetApp)) && !!targetApp) ||
            packageEscape ||
            ((area === "apps" || area === "libs" || area === "infra") && target?.[1] === "tools") ||
            (dbAdmin &&
              ((area === "apps" && owner === "user") ||
                (area === "libs" && !withinDb && !isTest) ||
                dbRoot)) ||
            (dbOperations &&
              (area === "apps" ||
                (area === "libs" &&
                  (dbRoot || (!withinDb && !(isTest && /\/testing(?:[/.]|$)/.test(resolved))))))) ||
            (!withinDb &&
              /^(?:drizzle-orm|drizzle-kit|better-sqlite3|sqlite3|node:sqlite|pg|postgres)(?:\/|$)/.test(
                clean,
              )) ||
            (!isTest &&
              /(?:\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$|^@template\/db\/testing$)/.test(clean)) ||
            /^@template\/[^/]+\/src(?:\/|$)/.test(clean) ||
            (area === "apps" && owner !== "user" && clean === "@template/ui/signup") ||
            (area === "apps" &&
              owner === "wiki" &&
              ((/^@template\/db(?:\/|$)/.test(clean) && clean !== "@template/db/local") ||
                /\/libs\/db(?:\/|$)/.test(resolved)));
          if (forbidden) context.report({ node, messageId: "violation" });
        }
        return {
          ImportDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => {
            if (node.source) check(node.source);
          },
          ExportAllDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          TSImportType: (node) => check(node.source),
          TSExternalModuleReference: (node) => check(node.expression),
          MemberExpression: checkD1,
          ObjectPattern(node) {
            if (
              !rawD1Allowed &&
              node.typeAnnotation &&
              destructuresD1Operation(context, node, node.typeAnnotation)
            )
              context.report({ node, messageId: "violation" });
          },
          VariableDeclarator(node) {
            if (!rawD1Allowed && node.init && destructuresD1Operation(context, node.id, node.init))
              context.report({ node, messageId: "violation" });
          },
          AssignmentExpression(node) {
            if (!rawD1Allowed && destructuresD1Operation(context, node.left, node.right))
              context.report({ node, messageId: "violation" });
          },
          CallExpression(node) {
            checkD1(node.callee);
            if (
              origins(context, node.callee).some(
                (origin) => origin[0] === "require" && origin.length === 1,
              )
            ) {
              const argument = node.arguments[0];
              if (argument) check(argument);
            }
          },
        };
      },
    },
    "no-internal-mocks": {
      meta: metadata(
        "内部処理・関数・DB のモックは禁止です。別名や分割代入も使用できません。実 DB と実サービスで検証してください。外部 HTTP の置換だけ MSW を利用できます。",
      ),
      create(context) {
        const check = (node: ESTree.Node) => {
          if (origins(context, node).some(isMock)) context.report({ node, messageId: "violation" });
        };
        return {
          CallExpression: (node) => check(node.callee),
          MemberExpression: check,
          AssignmentExpression(node) {
            if (
              node.left.type === "ObjectPattern" &&
              destructuredOrigins(context, node.left, origins(context, node.right)).some(isMock)
            ) {
              context.report({ node, messageId: "violation" });
            }
          },
          ImportDeclaration(node) {
            for (const specifier of node.specifiers) check(specifier.local);
          },
          VariableDeclarator(node) {
            if (node.id.type !== "ObjectPattern") return;
            for (const variable of context.sourceCode.getDeclaredVariables(node)) {
              for (const identifier of variable.identifiers) check(identifier);
            }
          },
        };
      },
    },
    "worker-fetch": {
      meta: metadata(
        'Cloudflare Workers の fetch は redirect: "error" を実行時に拒否します。Worker で動くコードでは redirect: "manual" を指定し、3xx を失敗として扱ってください。ブラウザ・Node 専用のファイルだけで "error" を使えます。',
      ),
      create(context) {
        const current = filename(context);
        if (
          !/\/(?:apps|libs|infra\/(?:budget|error)-monitor)\//.test(current) ||
          /\/libs\/ui\/|\/libs\/observability\/src\/browser\.ts$|\/libs\/runtime\/src\/client\.ts$|\/libs\/db\/src\/remote[^/]*\.ts$|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(
            current,
          )
        )
          return {};
        return {
          Property(node) {
            const key =
              !node.computed && node.key.type === "Identifier"
                ? node.key.name
                : staticText(context, node.key);
            if (key === "redirect" && staticText(context, node.value) === "error")
              context.report({ node, messageId: "violation" });
          },
        };
      },
    },
    "environment-boundary": {
      meta: metadata(
        "環境値の直接参照は禁止です。process.env / import.meta.env は別名・分割代入も含め libs/config の検証境界へ集約してください。運用 CLI とインフラの境界では Valibot で検証してください。",
      ),
      create(context) {
        if (/\/(?:libs\/config|infra|tools)\//.test(filename(context))) return {};
        const check = (node: ESTree.Node) => {
          if (origins(context, node).some(isEnvironment))
            context.report({ node, messageId: "violation" });
        };
        return {
          MemberExpression: check,
          AssignmentExpression(node) {
            if (
              node.left.type === "ObjectPattern" &&
              destructuredOrigins(context, node.left, origins(context, node.right)).some(
                isEnvironment,
              )
            ) {
              context.report({ node, messageId: "violation" });
            }
          },
          ImportDeclaration(node) {
            for (const specifier of node.specifiers) check(specifier.local);
          },
          ExportNamedDeclaration(node) {
            if (!node.source || !["node:process", "process"].includes(node.source.value)) return;
            for (const specifier of node.specifiers) {
              const name =
                specifier.local.type === "Identifier"
                  ? specifier.local.name
                  : specifier.local.value;
              if (name === "env") context.report({ node: specifier, messageId: "violation" });
            }
          },
          VariableDeclarator(node) {
            if (node.id.type !== "ObjectPattern") return;
            for (const variable of context.sourceCode.getDeclaredVariables(node)) {
              for (const identifier of variable.identifiers) check(identifier);
            }
          },
        };
      },
    },
  },
});
