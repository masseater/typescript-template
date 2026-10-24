import { presets as effectPresets } from "@effect/tsgo/oxlint-presets";
import eslintReact from "@eslint-react/eslint-plugin";
import htmlReact from "@html-eslint/eslint-plugin-react";
import { plugin as shadcn } from "@shadcn/lint";
import tanstackQuery from "@tanstack/eslint-plugin-query";
import tanstackRouter from "@tanstack/eslint-plugin-router";
import { Array, Record, String, Struct, pipe } from "effect";
import baselineJs from "eslint-plugin-baseline-js";
import reactHooks from "eslint-plugin-react-hooks";

import decisionPlugin from "./decision-rules.ts";

const REACT_STATE_HOOKS: readonly string[] = [
  "useState",
  "useReducer",
  "createContext",
  "useContext",
];
const HAND_WRITTEN_SQL = "SQL を手書きせず Drizzle のクエリビルダーを使う";
const UI_STATE = "UI 状態は effect-atom だけで扱う";

const requiredStack: Readonly<Record<string, readonly string[]>> = {
  [UI_STATE]: [
    "zustand",
    "jotai",
    "valtio",
    "recoil",
    "mobx",
    "mobx-*",
    "redux",
    "@reduxjs/*",
    "react-redux",
    "xstate",
    "@xstate/*",
    "nanostores",
    "@nanostores/*",
    "@preact/signals*",
  ],
  "サーバー状態は TanStack Query と Eden だけで扱う": [
    "swr",
    "react-query",
    "@apollo/*",
    "urql",
    "@urql/*",
    "axios",
    "ky",
    "ofetch",
    "got",
    "node-fetch",
    "graphql-request",
    "@trpc/*",
  ],
  "ルーティングとサーバーは TanStack Start と Elysia だけで扱う": [
    "react-router",
    "react-router-dom",
    "next",
    "@remix-run/*",
    "wouter",
    "express",
    "hono",
    "fastify",
    "koa",
    "@nestjs/*",
  ],
  "データベースは Drizzle だけで扱い、スキーマはマイグレーションで生成する": [
    "prisma",
    "@prisma/*",
    "typeorm",
    "sequelize",
    "kysely",
    "knex",
    "@mikro-orm/*",
    "better-sqlite3",
    "pg",
    "mysql2",
  ],
  "認証は better-auth だけで扱う": [
    "next-auth",
    "@auth/*",
    "lucia",
    "passport",
    "passport-*",
    "@clerk/*",
    "firebase/auth",
    "@supabase/*",
  ],
  "UI は shadcn/ui と Tailwind CSS だけで組む": [
    "@mui/*",
    "antd",
    "@chakra-ui/*",
    "@mantine/*",
    "styled-components",
    "@emotion/*",
    "bootstrap",
    "react-bootstrap",
  ],
  "検証、日時、ログ、関数型ユーティリティは Effect だけで扱う": [
    "zod",
    "yup",
    "joi",
    "valibot",
    "arktype",
    "io-ts",
    "superstruct",
    "moment",
    "dayjs",
    "date-fns",
    "luxon",
    "winston",
    "pino",
    "bunyan",
    "loglevel",
    "lodash",
    "lodash-es",
    "ramda",
    "rxjs",
    "fp-ts",
    "neverthrow",
    "ts-results",
    "purify-ts",
  ],
  "フィーチャーフラグは OpenFeature だけで扱う": [
    "launchdarkly-*",
    "@launchdarkly/*",
    "@growthbook/*",
    "unleash-client",
    "flagsmith",
    "@vercel/flags",
  ],
  "計装は Effect のトレーシングだけで扱う": ["@opentelemetry/*", "dd-trace", "newrelic"],
  "インフラは Alchemy の IaC と Cloudflare だけで扱い、wrangler は使わない": [
    "wrangler",
    "miniflare",
    "@cloudflare/vite-plugin",
    "@vercel/*",
    "@netlify/*",
    "aws-cdk",
    "aws-cdk-lib",
    "@pulumi/*",
    "cdktf",
  ],
};

const requiredStackEntries = pipe(
  Record.toEntries(requiredStack),
  Array.flatMap(([message, modules]) =>
    pipe(
      modules,
      Array.map((module) => ({ message, module })),
    ),
  ),
);

const requiredStackPaths: readonly Readonly<{ name: string; message: string }>[] = pipe(
  requiredStackEntries,
  Array.filter(({ module }) => !pipe(module, String.includes("*"))),
  Array.map(({ message, module }) => ({ name: module, message })),
);

const requiredStackPatterns: readonly Readonly<{ group: readonly string[]; message: string }>[] =
  pipe(
    requiredStackEntries,
    Array.map(({ message, module }) => {
      if (pipe(module, String.includes("*"))) {
        return { group: [module, `${module}/**`], message };
      }
      return { group: [`${module}/**`], message };
    }),
  );

const restrictedImports = {
  paths: [
    {
      name: "react",
      importNames: [...REACT_STATE_HOOKS],
      message: UI_STATE,
    },
    { name: "drizzle-orm", importNames: ["sql"], message: HAND_WRITTEN_SQL },
    { name: "drizzle-orm/sql", message: HAND_WRITTEN_SQL },
    ...requiredStackPaths,
  ],
  patterns: [...requiredStackPatterns],
};

const generated = [
  "**/routeTree.gen.ts",
  "**/generated/**",
  "**/drizzle/**/snapshot.json",
  ".claude/skills/**",
  ".claude/hooks/fallow-gate.sh",
  ".intent/**",
  "AGENTS.md",
  "skills-lock.json",
  "CHANGELOG.md",
];

const decisionPluginName = decisionPlugin.meta.name;

type Rules = Record.ReadonlyRecord<string, "error">;

const asErrors = (names: readonly string[]): Rules =>
  Record.fromEntries(
    pipe(
      names,
      Array.map((name) => [name, "error"] as const),
    ),
  );

const prefixed = (
  prefix: string,
  plugin: Readonly<{ rules: Record.ReadonlyRecord<string, unknown> }>,
): Rules =>
  asErrors(
    pipe(
      Record.keys(plugin.rules),
      Array.map((rule) => `${prefix}/${rule}`),
    ),
  );

const turnedOff = (rules: Rules): Record.ReadonlyRecord<string, "off"> =>
  pipe(
    rules,
    Record.map(() => "off" as const),
  );

const decisionRules = prefixed(decisionPluginName, decisionPlugin);

const tanstackQueryRules = prefixed("tanstack-query", tanstackQuery);

const tanstackRouterRules = prefixed("tanstack-router", tanstackRouter);

const shadcnRules = prefixed("shadcn", shadcn);

const baselineJsRules = prefixed("baseline-js", baselineJs);

const reactHooksRuleNames = pipe(
  Struct.keys(reactHooks.configs["recommended-latest"].rules),
  Array.map(String.replace("react-hooks/", "react-hooks-js/")),
);

const reactHooksRules = asErrors(reactHooksRuleNames);

const eslintReactRuleNames = pipe(
  Struct.keys(eslintReact.configs["strict-typescript"].rules ?? {}),
  Array.filter(
    (name) => !(pipe(name, String.replace("@eslint-react/", "react-hooks-js/")) in reactHooksRules),
  ),
);

const eslintReactRules = asErrors(eslintReactRuleNames);

const htmlReactRules = asErrors(Struct.keys(htmlReact.configs.all.rules ?? {}));

const effectRuleNames = pipe(
  Record.values(effectPresets),
  Array.flatMap((preset) => Struct.keys(preset.rules ?? {})),
);

const effectRules = asErrors(effectRuleNames);

export type { Rules };
export {
  baselineJsRules,
  decisionPluginName,
  decisionRules,
  effectRules,
  eslintReactRules,
  generated,
  htmlReactRules,
  reactHooksRules,
  requiredStack,
  restrictedImports,
  shadcnRules,
  tanstackQueryRules,
  tanstackRouterRules,
  turnedOff,
};
