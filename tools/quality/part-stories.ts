// oxlint-disable-next-line import/no-nodejs-modules
import { readFileSync, readdirSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";

import { parseSync } from "vite-plus";

import { field } from "./dependencies.ts";

interface A11yRelaxation {
  readonly file: string;
  readonly rule: string;
  readonly story: string;
}

interface ExportedStory {
  readonly name: string;
  readonly options: unknown;
}

const storySuffix = ".stories.tsx";

const storyFiles: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../libs/ui/src/**/*.stories.tsx",
);

function storyName(part: string): string {
  return part.replace(/\.tsx$/u, storySuffix);
}

function storylessParts(directory: string): string[] {
  // oxlint-disable-next-line node/no-sync
  const files = readdirSync(directory).filter((file) => file.endsWith(".tsx"));
  const stories = new Set(files.filter((file) => file.endsWith(storySuffix)));
  return files
    .filter((file) => !stories.has(file) && !stories.has(storyName(file)))
    .map(
      (file) =>
        `${file}: 部品の隣に ${storyName(file)} を置いてください。story がない部品はブラウザテストと a11y 検査を受けません。`,
    )
    .toSorted();
}

function nodes(node: unknown, key: string): unknown[] {
  const value: unknown = field(node, key);
  return Array.isArray(value) ? value : [];
}

function property(node: unknown, name: string): unknown {
  const found = nodes(node, "properties").find(
    (entry: unknown) => field(field(entry, "key"), "name") === name,
  );
  return field(found, "value");
}

function literal(node: unknown): unknown {
  return field(node, "value");
}

function disabledRules(a11y: unknown): string[] {
  const disabled = nodes(property(property(a11y, "config"), "rules"), "elements").flatMap(
    (rule: unknown) => {
      const id: unknown = literal(property(rule, "id"));
      return literal(property(rule, "enabled")) === false && typeof id === "string" ? [id] : [];
    },
  );
  const test: unknown = literal(property(a11y, "test"));
  return typeof test !== "string" || test === "error" ? disabled : [...disabled, `test:${test}`];
}

function exportedStories(body: readonly unknown[]): ExportedStory[] {
  return body
    .filter((node: unknown) => field(node, "type") === "ExportNamedDeclaration")
    .flatMap((node: unknown) => nodes(field(node, "declaration"), "declarations"))
    .map((declaration: unknown) => ({
      name: String(field(field(declaration, "id"), "name")),
      options: nodes(field(declaration, "init"), "arguments").at(0),
    }));
}

function fileRelaxations(file: string): A11yRelaxation[] {
  // oxlint-disable-next-line node/no-sync
  const { program } = parseSync(file, readFileSync(file, "utf-8"));
  return exportedStories(nodes(program, "body")).flatMap(
    ({ name, options }: Readonly<ExportedStory>) =>
      disabledRules(property(property(options, "parameters"), "a11y")).map((rule) => ({
        file,
        rule,
        story: name,
      })),
  );
}

function a11yRelaxations(): A11yRelaxation[] {
  return Object.keys(storyFiles)
    .map((key) => key.replace(/^(?:\.\.\/)+/u, ""))
    .toSorted()
    .flatMap((file) => fileRelaxations(file))
    .toSorted(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.story.localeCompare(right.story) ||
        left.rule.localeCompare(right.rule),
    );
}

const partsManifest = new URL("../../libs/ui/package.json", import.meta.url);
const workerFile = "libs/ui/.storybook/public/mockServiceWorker.js";
const agentConfigFile = ".mcp.json";

function vendoredWorkerViolations(): string[] {
  // oxlint-disable-next-line node/no-sync
  const { program } = parseSync(workerFile, readFileSync(workerFile, "utf-8"));
  const declarator = nodes(program, "body")
    .flatMap((node: unknown) => nodes(node, "declarations"))
    .find((declaration: unknown) => field(field(declaration, "id"), "name") === "PACKAGE_VERSION");
  const vendored: unknown = literal(field(declarator, "init"));
  const manifest = createRequire(partsManifest).resolve("msw/package.json");
  // oxlint-disable-next-line node/no-sync
  const installed: unknown = field(JSON.parse(readFileSync(manifest, "utf-8")), "version");
  return vendored === installed
    ? []
    : [
        `${workerFile}: msw ${String(installed)} に対して ${String(vendored)} のままです。vp exec msw init .storybook/public で取り直してください。`,
      ];
}

function storybookEndpointViolations(origin: string): string[] {
  // oxlint-disable-next-line node/no-sync
  const parsed: unknown = JSON.parse(readFileSync(agentConfigFile, "utf-8"));
  const url: unknown = field(field(field(parsed, "mcpServers"), "storybook"), "url");
  const expected = `${origin}/mcp`;
  return url === expected
    ? []
    : [
        `${agentConfigFile}: storybook の url は ${expected} である必要があります（現在: ${String(url)}）。`,
      ];
}

export { a11yRelaxations, storybookEndpointViolations, storylessParts, vendoredWorkerViolations };
