import { repositoryFile } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { parseSync } from "vite-plus";

import { read, type HostRead } from "./design-system-test-fixture.ts";
import { field } from "./record-field-test-fixture.ts";

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
  "./src/features/ui/**/*.stories.tsx",
);

const storyName = (part: string): string => {
  return part.replace(/\.tsx$/u, storySuffix);
};

const storylessParts = (directory: string): HostRead<string[]> =>
  Effect.flatMap(FileSystem.FileSystem, (filesystem) =>
    filesystem.readDirectory(repositoryFile(directory)),
  ).pipe(
    Effect.map((entries) => {
      const files = entries.filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));
      const stories = new Set(files.filter((file) => file.endsWith(storySuffix)));
      const missing: string[] = [];
      for (const file of files) {
        if (!stories.has(file) && !stories.has(storyName(file))) {
          missing.push(
            `${file}: 部品の隣に ${storyName(file)} を置いてください。story がない部品はブラウザテストと a11y 検査を受けません。`,
          );
        }
      }
      return missing.toSorted();
    }),
  );

const nodes = (node: unknown, key: string): unknown[] => {
  const value: unknown = field(node, key);
  return Array.isArray(value) ? value : [];
};

const property = (node: unknown, name: string): unknown => {
  const found = nodes(node, "properties").find(
    (entry: unknown) => field(field(entry, "key"), "name") === name,
  );
  return field(found, "value");
};

const literal = (node: unknown): unknown => {
  return field(node, "value");
};

const disabledRules = (a11y: unknown): string[] => {
  const disabled = nodes(property(property(a11y, "config"), "rules"), "elements").flatMap(
    (rule: unknown) => {
      const id: unknown = literal(property(rule, "id"));
      return literal(property(rule, "enabled")) === false && typeof id === "string" ? [id] : [];
    },
  );
  const test: unknown = literal(property(a11y, "test"));
  return typeof test !== "string" || test === "error" ? disabled : [...disabled, `test:${test}`];
};

const exportedStories = (body: readonly unknown[]): ExportedStory[] => {
  const stories: ExportedStory[] = [];
  for (const node of body) {
    if (field(node, "type") !== "ExportNamedDeclaration") {
      continue;
    }
    for (const declaration of nodes(field(node, "declaration"), "declarations")) {
      stories.push({
        name: String(field(field(declaration, "id"), "name")),
        options: nodes(field(declaration, "init"), "arguments").at(0),
      });
    }
  }
  return stories;
};

const fileRelaxations = (file: string): HostRead<A11yRelaxation[]> =>
  Effect.map(read(file), (source) => {
    const { program } = parseSync(file, source);
    return exportedStories(nodes(program, "body")).flatMap(
      ({ name, options }: Readonly<ExportedStory>) =>
        disabledRules(property(property(options, "parameters"), "a11y")).map((rule) => ({
          file,
          rule,
          story: name,
        })),
    );
  });

const a11yRelaxations = (): HostRead<A11yRelaxation[]> =>
  Effect.map(
    Effect.forEach(
      Object.keys(storyFiles)
        .map((key) => key.replace(/^\.\//u, "libs/ui/"))
        .toSorted(),
      (file) => fileRelaxations(file),
    ),
    (relaxations) =>
      relaxations
        .flat()
        .toSorted(
          (left, right) =>
            left.file.localeCompare(right.file) ||
            left.story.localeCompare(right.story) ||
            left.rule.localeCompare(right.rule),
        ),
  );

const workerFile = "libs/ui/storybook/public/mockServiceWorker.js";

const vendoredWorkerViolations = (): HostRead<string[]> =>
  Effect.gen(function* vendoredWorkerViolations() {
    const { program } = parseSync(workerFile, yield* read(workerFile));
    const declarator = nodes(program, "body")
      .flatMap((node: unknown) => nodes(node, "declarations"))
      .find(
        (declaration: unknown) => field(field(declaration, "id"), "name") === "PACKAGE_VERSION",
      );
    const vendored: unknown = literal(field(declarator, "init"));
    const paths = yield* Path.Path;
    const manifest = yield* paths.fromFileUrl(new URL(import.meta.resolve("msw/package.json")));
    const installed: unknown = field(JSON.parse(yield* read(manifest)), "version");
    return vendored === installed
      ? []
      : [
          `${workerFile}: msw ${String(installed)} に対して ${String(vendored)} のままです。vp exec msw init storybook/public で取り直してください。`,
        ];
  });

const agentConfigFile = ".mcp.json";

const storybookEndpointViolations = (origin: string): HostRead<string[]> =>
  Effect.map(read(agentConfigFile), (source) => {
    const parsed: unknown = JSON.parse(source);
    const url: unknown = field(field(field(parsed, "mcpServers"), "storybook"), "url");
    const expected = `${origin}/mcp`;
    return url === expected
      ? []
      : [
          `${agentConfigFile}: storybook の url は ${expected} である必要があります（現在: ${String(url)}）。`,
        ];
  });

export { a11yRelaxations, storybookEndpointViolations, storylessParts, vendoredWorkerViolations };
export type { A11yRelaxation };
