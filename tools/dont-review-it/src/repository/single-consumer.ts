import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  declaredDependencies,
  field,
  workspaceManifests,
  type WorkspaceManifest,
} from "./dependencies.ts";
import { repositoryRoot } from "./repository-root.ts";

const areas = new Set(["apps", "libs", "infra", "tools"]);

const skippedNames = new Set(["node_modules", "dist", "coverage", "storybook-static"]);

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".css",
  ".json",
]);

const scriptExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".css",
]);

const callPrefixes = ["import.meta.resolve(", "require.resolve(", "import(", "require("] as const;

const rootManifests: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../package.json",
  {
    eager: true,
    import: "default",
  },
);

interface Finding {
  readonly id: string;
  readonly message: string;
}

interface SourceText {
  readonly file: string;
  readonly text: string;
}

type ScanMode = "code" | "line" | "block" | "single" | "double" | "template";

interface Read {
  readonly next: number;
  readonly value: string;
}

const singleConsumerAllowlist: readonly string[] = [
  "package:@repo/dont-review-it",
  "package:@repo/interview",
  "subpath:@repo/auth-ui/signup",
  "subpath:@repo/auth/testing",
  "subpath:@repo/db/bootstrap",
  "subpath:@repo/db/interview",
  "subpath:@repo/db/remote",
  "subpath:@repo/db/security",
  "subpath:@repo/dont-review-it/lint",
  "subpath:@repo/dont-review-it/lint-rule-authoring",
  "subpath:@repo/dont-review-it/lint-rule-authoring/plugin",
  "subpath:@repo/dont-review-it/plugin",
  "subpath:@repo/dont-review-it/record-fields",
  "subpath:@repo/dont-review-it/repository-checks",
  "subpath:@repo/dont-review-it/repository-plugin",
  "subpath:@repo/dont-review-it/test-runtime",
  "subpath:@repo/dont-review-it/vitest",
  "subpath:@repo/dont-review-it/vitest/parsed-fields",
  "subpath:@repo/interview/contracts",
  "subpath:@repo/monitor/fixture",
  "subpath:@repo/runtime/contracts",
  "subpath:@repo/ui/lint-settings",
  "subpath:@repo/ui/storybook/preview",
];

const isIdent = (char: string): boolean => /[A-Za-z0-9_$]/u.test(char);

const boundaryBefore = (text: string, index: number): boolean => {
  const previous = index === 0 ? "" : (text[index - 1] ?? "");
  return previous === "" || !isIdent(previous);
};

const startsWithWord = (text: string, index: number, word: string): boolean => {
  const after = text[index + word.length] ?? "";
  return boundaryBefore(text, index) && text.startsWith(word, index) && !isIdent(after);
};

const skipSpace = (text: string, index: number): number => {
  let cursor = index;
  while (cursor < text.length && /\s/u.test(text[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
};

const readString = (text: string, index: number): Read | undefined => {
  const quote = text[index];
  if (quote !== '"' && quote !== "'" && quote !== "`") {
    return undefined;
  }
  let value = "";
  let cursor = index + 1;
  while (cursor < text.length) {
    const char = text[cursor] ?? "";
    if (char === "\\") {
      value += text[cursor + 1] ?? "";
      cursor += 2;
      continue;
    }
    if (quote === "`" && char === "$" && text[cursor + 1] === "{") {
      return undefined;
    }
    if (char === quote) {
      return { next: cursor + 1, value };
    }
    value += char;
    cursor += 1;
  }
  return undefined;
};

const stringAfterSpace = (text: string, index: number): Read | undefined =>
  readString(text, skipSpace(text, index));

const propertySpecifier = (text: string, index: number): Read | undefined => {
  if (!startsWithWord(text, index, "specifier")) {
    return undefined;
  }
  let cursor = skipSpace(text, index + "specifier".length);
  if (text[cursor] !== ":") {
    return undefined;
  }
  cursor = skipSpace(text, cursor + 1);
  return readString(text, cursor);
};

const remember = (found: string[], read: Read | undefined): void => {
  if (read !== undefined && read.value.startsWith("@repo/")) {
    found.push(read.value);
  }
};

const codeSpecifiers = (text: string): readonly string[] => {
  const found: string[] = [];
  let index = 0;
  let mode: ScanMode = "code";
  while (index < text.length) {
    const char = text[index] ?? "";
    if (mode === "line") {
      mode = char === "\n" ? "code" : mode;
      index += 1;
      continue;
    }
    if (mode === "block") {
      if (char === "*" && text[index + 1] === "/") {
        mode = "code";
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (mode === "single" || mode === "double" || mode === "template") {
      if (char === "\\") {
        index += 2;
        continue;
      }
      const quote = mode === "single" ? "'" : mode === "double" ? '"' : "`";
      if (char === quote) {
        mode = "code";
      }
      index += 1;
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      mode = "line";
      index += 2;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      mode = "block";
      index += 2;
      continue;
    }
    if (char === "'") {
      mode = "single";
      index += 1;
      continue;
    }
    if (char === '"') {
      mode = "double";
      index += 1;
      continue;
    }
    if (char === "`") {
      mode = "template";
      index += 1;
      continue;
    }
    const prefix = boundaryBefore(text, index)
      ? callPrefixes.find((candidate) => text.startsWith(candidate, index))
      : undefined;
    if (prefix !== undefined) {
      const read = stringAfterSpace(text, index + prefix.length);
      remember(found, read);
      index = read?.next ?? index + prefix.length;
      continue;
    }
    const property = propertySpecifier(text, index);
    if (property !== undefined) {
      remember(found, property);
      index = property.next;
      continue;
    }
    const word = (["from", "import"] as const).find((candidate) =>
      startsWithWord(text, index, candidate),
    );
    if (word !== undefined) {
      const read = stringAfterSpace(text, index + word.length);
      remember(found, read);
      index = read?.next ?? index + word.length;
      continue;
    }
    index += 1;
  }
  return found;
};

const extendsSpecifiers = (text: string): readonly string[] => {
  const matched = /"extends"\s*:\s*(\[[\s\S]*?\]|"(?:[^"\\]|\\.)*")/u.exec(text);
  const value = matched?.[1];
  if (value === undefined) {
    return [];
  }
  const specs: string[] = [];
  for (const found of value.matchAll(/"(@repo\/[^"]+)"/gu)) {
    const spec = found[1];
    if (spec !== undefined) {
      specs.push(spec);
    }
  }
  return specs;
};

const moduleSpecifiers = (filename: string, text: string): readonly string[] => {
  if (filename.endsWith(".json")) {
    return extendsSpecifiers(text);
  }
  return scriptExtensions.has(path.posix.extname(filename)) ? codeSpecifiers(text) : [];
};

const skippedDirectory = (name: string): boolean => name.startsWith(".") || skippedNames.has(name);

const relativeFile = (root: string, absolute: string): string =>
  path.relative(root, absolute).split(path.sep).join("/");

const listedSources = (directory: string, root: string): SourceText[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (skippedDirectory(entry.name)) {
      return [];
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listedSources(absolute, root);
    }
    if (entry.name === "package.json" || !sourceExtensions.has(path.extname(entry.name))) {
      return [];
    }
    return [{ file: relativeFile(root, absolute), text: readFileSync(absolute, "utf8") }];
  });

const repositorySources = (root: string): readonly SourceText[] => {
  const nested = ["apps", "libs", "infra", "tools"].flatMap((area) =>
    listedSources(path.join(root, area), root),
  );
  const top = readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.isDirectory() ||
      entry.name === "package.json" ||
      !sourceExtensions.has(path.extname(entry.name))
    ) {
      return [];
    }
    return [
      {
        file: entry.name,
        text: readFileSync(path.join(root, entry.name), "utf8"),
      },
    ];
  });
  return [...nested, ...top];
};

const workspaceOf = (file: string): string => {
  const [area, name] = file.split("/");
  return area !== undefined && name !== undefined && name !== "" && areas.has(area)
    ? `${area}/${name}`
    : "root";
};

const directoryOf = (file: string): string => {
  const directory = path.posix.dirname(file);
  return directory === "." || directory === "" ? "root" : directory;
};

const specifierIndex = (
  sources: readonly SourceText[],
): ReadonlyMap<string, ReadonlySet<string>> => {
  const index = new Map<string, Set<string>>();
  for (const source of sources) {
    const workspace = workspaceOf(source.file);
    for (const specifier of moduleSpecifiers(source.file, source.text)) {
      const current = index.get(specifier);
      if (current === undefined) {
        index.set(specifier, new Set([workspace]));
      } else {
        current.add(workspace);
      }
    }
  }
  return index;
};

const importers = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
  matches: (specifier: string) => boolean,
  self: string,
): readonly string[] => {
  const found = new Set<string>();
  for (const [specifier, workspaces] of index) {
    if (!matches(specifier)) {
      continue;
    }
    for (const workspace of workspaces) {
      if (workspace !== self) {
        found.add(workspace);
      }
    }
  }
  return [...found].sort();
};

const dependencyConsumers = (
  name: string,
  self: string,
  workspaces: readonly WorkspaceManifest[],
): readonly string[] =>
  [
    ...new Set(
      workspaces.flatMap((workspace) => {
        const directory = directoryOf(workspace.file);
        return directory !== self && declaredDependencies(workspace.manifest).includes(name)
          ? [directory]
          : [];
      }),
    ),
  ].sort();

const counted = (consumers: readonly string[]): string => {
  const where = consumers.length === 0 ? "" : `（${consumers.join(", ")}）`;
  return `${String(consumers.length)}${where}`;
};

const packageMessage = (file: string, name: string, consumers: readonly string[]): string =>
  `${file}: ${name} の dependencies 取り込み元は ${counted(consumers)} です。共有パッケージは 2 つ以上のワークスペースが取り込むときだけ残します。`;

const subpathMessage = (file: string, specifier: string, consumers: readonly string[]): string =>
  `${file}: ${specifier} の import 元は ${counted(consumers)} です。exports のサブパスは 2 つ以上のワークスペースが取り込むときだけ残します。`;

const subpathTarget = (
  packageName: string,
  key: string,
): { readonly specifier: string; readonly wildcard: boolean } | undefined => {
  if (!key.startsWith("./") || key === "./package.json") {
    return undefined;
  }
  if (key.endsWith("/*")) {
    return { specifier: `${packageName}/${key.slice(2, -2)}`, wildcard: true };
  }
  return { specifier: `${packageName}/${key.slice(2)}`, wildcard: false };
};

const exportKeys = (manifest: unknown): readonly string[] => {
  const exportsField = field(manifest, "exports");
  return typeof exportsField === "object" && exportsField !== null && !Array.isArray(exportsField)
    ? Object.keys(exportsField)
    : [];
};

const singleConsumerFindings = (
  workspaces: readonly WorkspaceManifest[],
  sources: readonly SourceText[],
): readonly Finding[] => {
  const index = specifierIndex(sources);
  return workspaces
    .flatMap((workspace): readonly Finding[] => {
      const name = field(workspace.manifest, "name");
      if (typeof name !== "string" || (workspace.area !== "libs" && workspace.area !== "tools")) {
        return [];
      }
      const self = directoryOf(workspace.file);
      const dependencies = dependencyConsumers(name, self, workspaces);
      const imported = importers(
        index,
        (specifier) => specifier === name || specifier.startsWith(`${name}/`),
        self,
      );
      if (workspace.area === "tools" && dependencies.length === 0 && imported.length === 0) {
        return [];
      }
      const packageFinding =
        dependencies.length < 2
          ? [
              {
                id: `package:${name}`,
                message: packageMessage(workspace.file, name, dependencies),
              },
            ]
          : [];
      const subpathFindings = exportKeys(workspace.manifest).flatMap((key) => {
        const target = subpathTarget(name, key);
        if (target === undefined) {
          return [];
        }
        const consumers = importers(
          index,
          (specifier) =>
            target.wildcard
              ? specifier === target.specifier || specifier.startsWith(`${target.specifier}/`)
              : specifier === target.specifier,
          self,
        );
        return consumers.length < 2
          ? [
              {
                id: `subpath:${target.specifier}`,
                message: subpathMessage(workspace.file, target.specifier, consumers),
              },
            ]
          : [];
      });
      return [...packageFinding, ...subpathFindings];
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const repositoryWorkspaces = (): readonly WorkspaceManifest[] => [
  ...workspaceManifests,
  ...Object.entries(rootManifests).map(([, manifest]) => ({
    area: ".",
    file: "package.json",
    manifest,
  })),
];

const repositorySingleConsumerFindings = (): readonly Finding[] =>
  singleConsumerFindings(repositoryWorkspaces(), repositorySources(repositoryRoot));

export {
  moduleSpecifiers,
  repositorySingleConsumerFindings,
  singleConsumerAllowlist,
  singleConsumerFindings,
};
export type { SourceText };
