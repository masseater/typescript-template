import { clientReachableModules, serverOnlyPackages } from "@repo/vite-config";

import {
  nodeRuntimePackages,
  testPattern,
  workerRuntimeModules,
  workerTestPattern,
  workerTestSuffix,
} from "./test-runtime.ts";

import type { IConfiguration } from "dependency-cruiser";

const anyOf = (values: readonly string[]): string => {
  return values.map((value) => value.replaceAll(".", String.raw`\.`)).join("|");
};

const testModule = String.raw`(?:\.(?:test|spec)|-fixture)\.[cm]?[jt]sx?$`;
const developmentModule = String.raw`${testModule}|\.stories\.tsx$`;
const databaseAdmin = String.raw`^libs/db/src/admin\.ts$`;
const databaseOperations = String.raw`^libs/db(?:-local)?/src/(?:remote|bootstrap|migrat)[^/]*\.ts$`;
const databaseInternal = String.raw`^libs/db(?:-local)?/src/(?:(?:remote|bootstrap|migrat|testing)[^/]*\.ts$|.*${testModule})`;
const testingEntry = String.raw`^libs/[^/]+/src/testing[^/]*\.ts$`;
const rawDatabaseDriver = String.raw`(?:^|/)node_modules/(?:drizzle-orm|drizzle-kit|better-sqlite3|sqlite3|pg|postgres)/|^(?:node:)?sqlite$`;
const deploymentConfig = String.raw`^infra/cloudflare/src/deployment\.ts$`;
const objectStorage = String.raw`^libs/config/src/storage\.ts$`;
const objectStorageOwner = String.raw`^libs/(?:config|runtime|vite-config)/src/|^infra/cloudflare/src/`;
const serverOnlyModule = String.raw`^libs/(?:${serverOnlyPackages.join("|")})/src/`;
const clientReachableModule = String.raw`^(?:${anyOf(clientReachableModules)})$`;
const nodeRuntimePackage = String.raw`(?:^|/)node_modules/(?:${anyOf(nodeRuntimePackages)})/`;
const workerRuntimeModule = String.raw`^(?:${anyOf(workerRuntimeModules)})$`;

const generatedRouteTree = String.raw`routeTree\.gen\.ts$`;

const configuration: IConfiguration = {
  forbidden: [
    {
      comment:
        "循環依存です。依存の向きを一方通行にし、共有が必要なら下位のモジュールへ型や関数を移してください。",
      from: { pathNot: generatedRouteTree },
      name: "no-circular",
      severity: "error",
      to: { circular: true, pathNot: generatedRouteTree },
    },
    {
      comment:
        "依存先を解決できません。アプリはデプロイ単位で、取り込まれる面を持ちません。相手のパッケージが exports で公開している入口を指定し、その依存を package.json に宣言してください。",
      from: {},
      name: "no-unresolvable",
      severity: "error",
      to: { couldNotResolve: true, pathNot: workerRuntimeModule },
    },
    {
      comment:
        "アプリはデプロイ単位です。共有したい処理は libs/ のパッケージへ移し、そちらを参照してください。",
      from: { path: "^apps/([^/]+)/" },
      name: "no-app-to-app",
      severity: "error",
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      comment:
        "共有パッケージがデプロイ単位のアプリに依存しています。必要な処理をアプリから libs/ へ移してください。",
      from: { path: "^(?:libs|infra|tools)/" },
      name: "no-shared-to-app",
      severity: "error",
      to: { path: "^apps/" },
    },
    {
      comment:
        "tools/ は開発時の道具です。配布物に入るコードから参照せず、必要な処理を libs/ のパッケージへ移してください。",
      from: { path: "^(?:apps|libs|infra)/", pathNot: testModule },
      name: "no-runtime-to-tools",
      severity: "error",
      to: { path: "^tools/" },
    },
    {
      comment:
        "非公開のファイルへ相対パスで踏み込んでいます。相手のパッケージが exports で公開している入口を使ってください。",
      from: { path: "^(apps|libs|infra|tools)/([^/]+)/" },
      name: "no-package-escape",
      severity: "error",
      to: {
        dependencyTypes: ["local"],
        pathNot: String.raw`^$1/$2/|^libs/auth/src/testing\.ts$|^libs/db/src/migrate-d1\.ts$|^libs/db/src/remote-input\.ts$|^libs/ui/storybook/preview\.tsx$|^tools/dont-review-it/src/repository/ui-lint-settings\.ts$|^infra/cloudflare/src/remote-command\.ts$|^knip\.ts$`,
      },
    },
    {
      comment:
        "管理者専用の処理です。apps/service-admin と libs/db の中だけで使い、利用者向けのコードへ持ち込まないでください。",
      from: {
        path: "^(?:apps|libs)/",
        pathNot: `^apps/service-admin/|^libs/db/src/(?!index\\.ts$)|${testModule}`,
      },
      name: "no-database-admin-outside-admin",
      severity: "error",
      to: { path: databaseAdmin },
    },
    {
      comment:
        "本番 D1 への直接操作とローカル DB の構築です。infra/ と tools/ の運用コマンドからだけ呼んでください。",
      from: { path: "^(?:apps|libs)/", pathNot: databaseInternal },
      name: "no-database-operations-outside-tooling",
      severity: "error",
      to: { path: databaseOperations },
    },
    {
      comment:
        "R2 と KV のバインディングは libs/runtime の FileStore / ReadCache だけが掴みます。アプリは共有ヘルパーを呼び、バインディングを直接読まないでください。",
      from: { path: "^(?:apps|libs|infra)/", pathNot: objectStorageOwner },
      name: "no-object-storage-outside-runtime",
      severity: "error",
      to: { path: objectStorage },
    },
    {
      comment:
        "テスト専用の入口です。テストとフィクスチャからだけ使い、アプリの実装へ持ち込まないでください。",
      from: { path: "^(?:apps|libs|infra|tools)/", pathNot: testModule },
      name: "no-testing-entry-outside-tests",
      severity: "error",
      to: { path: testingEntry },
    },
    {
      comment:
        "生の DB ドライバーは libs/db と、feature クエリを所有する apps だけで使えます。共有 libs の業務処理は計測付きの @repo/db の入口を使ってください。",
      from: { pathNot: "^(?:libs/db/|apps/)" },
      name: "no-raw-database-driver",
      severity: "error",
      to: { path: rawDatabaseDriver },
    },
    {
      comment:
        "配布物に入るコードが devDependencies を取り込んでいます。その依存を dependencies に移すか、import type で型だけを取り込む形にしてください。型の再エクスポートは、その依存をパッケージの公開する面に載せるので同じ扱いです。",
      from: { path: "^(?:apps|libs|infra)/[^/]+/src/", pathNot: developmentModule },
      name: "no-development-dependency-in-shipped-code",
      severity: "error",
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
    {
      comment:
        "テストとフィクスチャは配布物に入りません。実装から参照せず、共有したい処理を通常のモジュールへ出してください。",
      from: { pathNot: testModule },
      name: "no-production-to-test",
      severity: "error",
      to: { path: testPattern },
    },
    {
      comment:
        "ブラウザへ配る部品からサーバー専用のパッケージへ到達しています。型だけが要るときも、サーバー専用のパッケージに到達しないモジュール（@repo/runtime/client など）から取ってください。到達するかどうかは経路の長さによらず、型としての参照も辺として数えます。",
      from: { path: "^libs/(?:ui|auth-ui)/src/", pathNot: testModule },
      name: "no-browser-to-server",
      severity: "error",
      to: { path: serverOnlyModule, pathNot: clientReachableModule, reachable: true },
    },
    {
      comment:
        "@repo/infra-cloudflare/deployment は node:os と node:path でデプロイ用の設定ファイルを解決します。apps と libs からは、経路の途中のモジュールも含めて到達できません。デプロイの入力が要るコードは infra か tools に置いてください。",
      from: { path: "^(?:apps|libs)/" },
      name: "no-deployment-config-in-shipped-code",
      severity: "error",
      to: { path: deploymentConfig, reachable: true },
    },
    {
      comment: `Worker のランタイムを掴むテストは ${workerTestSuffix} という名前にしてください。名前が実行先を決めるので、${workerRuntimeModules.join(" / ")} へ経路のどこかで到達するテストは Node のプールでは動きません。`,
      from: { path: testPattern, pathNot: workerTestPattern },
      name: "no-worker-runtime-in-node-test",
      severity: "error",
      to: { path: workerRuntimeModule, reachable: true },
    },
    {
      comment: `${workerTestSuffix} のテストは Worker のプールで動きます。Node の組み込みモジュールは、経路の途中のモジュールも含めて掴めません。`,
      from: { path: workerTestPattern },
      name: "no-node-builtin-in-worker-test",
      severity: "error",
      to: { dependencyTypes: ["core"] },
    },
    {
      comment: `${workerTestSuffix} のテストは Worker のプールで動きます。${nodeRuntimePackages.join(" / ")} は Node でしか動かないので、経路の途中のモジュールも含めて掴めません。`,
      from: { path: workerTestPattern },
      name: "no-node-runtime-package-in-worker-test",
      severity: "error",
      to: { path: nodeRuntimePackage, reachable: true },
    },
  ],
  options: {
    doNotFollow: { path: ["node_modules"] },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"],
      mainFields: ["module", "main", "types", "typings"],
    },
    exclude: { path: [String.raw`^(?:apps|libs|infra|tools)/[^/]+/(?:\.(?!storybook)|dist/)`] },
    parser: "swc",
  },
};

export default configuration;
