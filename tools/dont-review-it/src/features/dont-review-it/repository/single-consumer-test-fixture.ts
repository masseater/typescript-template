import { Effect, FileSystem, Path } from "effect";

import { directoryEntries, type TreeScan } from "../platform/directory-entries.ts";
import { path } from "../platform/path.ts";
import { posixPath } from "../platform/path.ts";
import {
  declaredDependencies,
  field,
  rootManifests,
  workspaceManifests,
  type WorkspaceManifest,
} from "./dependencies-test-fixture.ts";
import { repositoryRoot } from "./repository-root.ts";
import { commands, taskNames } from "./tasks-test-fixture.ts";

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

const isQuote = (char: string | undefined): char is '"' | "'" | "`" =>
  char === '"' || char === "'" || char === "`";

const opensInterpolation = (text: string, cursor: number, quote: string): boolean =>
  quote === "`" && text[cursor] === "$" && text[cursor + 1] === "{";

const readString = (text: string, index: number): Read | undefined => {
  const quote = text[index];
  if (!isQuote(quote)) {
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
    if (opensInterpolation(text, cursor, quote)) {
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

interface Scan {
  readonly next: number;
  readonly mode: ScanMode;
}

type QuotedMode = "single" | "double" | "template";

const closingQuotes = { double: '"', single: "'", template: "`" } as const satisfies Record<
  QuotedMode,
  string
>;

const openers = [
  ["//", "line"],
  ["/*", "block"],
  ["'", "single"],
  ['"', "double"],
  ["`", "template"],
] as const satisfies readonly (readonly [string, ScanMode])[];

const scanLineComment = (text: string, index: number): Scan => ({
  mode: text[index] === "\n" ? "code" : "line",
  next: index + 1,
});

const scanBlockComment = (text: string, index: number): Scan =>
  text.startsWith("*/", index)
    ? { mode: "code", next: index + 2 }
    : { mode: "block", next: index + 1 };

const scanQuoted = (text: string, index: number, mode: QuotedMode): Scan => {
  const char = text[index];
  if (char === "\\") {
    return { mode, next: index + 2 };
  }
  return { mode: char === closingQuotes[mode] ? "code" : mode, next: index + 1 };
};

const specifierAt = (
  text: string,
  index: number,
): { readonly read: Read | undefined; readonly next: number } | undefined => {
  const prefix = boundaryBefore(text, index)
    ? callPrefixes.find((candidate) => text.startsWith(candidate, index))
    : undefined;
  if (prefix !== undefined) {
    const read = stringAfterSpace(text, index + prefix.length);
    return { next: read?.next ?? index + prefix.length, read };
  }
  const property = propertySpecifier(text, index);
  if (property !== undefined) {
    return { next: property.next, read: property };
  }
  const word = (["from", "import"] as const).find((candidate) =>
    startsWithWord(text, index, candidate),
  );
  if (word === undefined) {
    return undefined;
  }
  const read = stringAfterSpace(text, index + word.length);
  return { next: read?.next ?? index + word.length, read };
};

const scanCode = (text: string, index: number, found: string[]): Scan => {
  const opener = openers.find(([token]) => text.startsWith(token, index));
  if (opener !== undefined) {
    return { mode: opener[1], next: index + opener[0].length };
  }
  const specifier = specifierAt(text, index);
  if (specifier === undefined) {
    return { mode: "code", next: index + 1 };
  }
  remember(found, specifier.read);
  return { mode: "code", next: specifier.next };
};

const scanStep = (text: string, scan: Scan, found: string[]): Scan => {
  if (scan.mode === "code") {
    return scanCode(text, scan.next, found);
  }
  if (scan.mode === "line") {
    return scanLineComment(text, scan.next);
  }
  if (scan.mode === "block") {
    return scanBlockComment(text, scan.next);
  }
  return scanQuoted(text, scan.next, scan.mode);
};

const codeSpecifiers = (text: string): readonly string[] => {
  const found: string[] = [];
  let scan: Scan = { mode: "code", next: 0 };
  while (scan.next < text.length) {
    scan = scanStep(text, scan, found);
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
  return scriptExtensions.has(posixPath.extname(filename)) ? codeSpecifiers(text) : [];
};

const skippedDirectory = (name: string): boolean => name.startsWith(".") || skippedNames.has(name);

const relativeFile = (root: string, absolute: string): string =>
  path.relative(root, absolute).split(path.sep).join("/");

const listedSources = (directory: string, root: string): TreeScan<SourceText[]> =>
  Effect.gen(function* scanSources() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const listed = yield* Effect.forEach(entries, (entry): TreeScan<SourceText[]> => {
      if (skippedDirectory(entry.name)) {
        return Effect.succeed([]);
      }
      const absolute = paths.join(directory, entry.name);
      if (entry.kind === "directory") {
        return listedSources(absolute, root);
      }
      if (entry.name === "package.json" || !sourceExtensions.has(paths.extname(entry.name))) {
        return Effect.succeed([]);
      }
      return Effect.map(filesystem.readFileString(absolute), (text) => [
        { file: relativeFile(root, absolute), text },
      ]);
    });
    return listed.flat();
  });

const repositorySources = (root: string): TreeScan<readonly SourceText[]> =>
  Effect.gen(function* repositorySources() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const nested = yield* Effect.forEach(["apps", "libs", "infra", "tools"], (area) =>
      listedSources(paths.join(root, area), root),
    );
    const topEntries = yield* directoryEntries(root);
    const top = yield* Effect.forEach(
      topEntries.filter(
        (entry) =>
          entry.kind !== "directory" &&
          entry.name !== "package.json" &&
          sourceExtensions.has(paths.extname(entry.name)),
      ),
      (entry) =>
        Effect.map(filesystem.readFileString(paths.join(root, entry.name)), (text) => ({
          file: entry.name,
          text,
        })),
    );
    return [...nested.flat(), ...top];
  });

const workspaceOf = (file: string): string => {
  const [area, name] = file.split("/");
  return area !== undefined && name !== undefined && name !== "" && areas.has(area)
    ? `${area}/${name}`
    : "root";
};

const directoryOf = (file: string): string => {
  const directory = posixPath.dirname(file);
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
  `${file}: ${name} の取り込み元は ${counted(consumers)} です。共有パッケージは 2 つ以上のワークスペースが取り込むときだけ残します。`;

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

const declaredBins = (manifest: unknown): readonly string[] => {
  const bin = field(manifest, "bin");
  if (typeof bin === "string") {
    const name = field(manifest, "name");
    return typeof name === "string" ? [name.replace(/^@[^/]+\//u, "")] : [];
  }
  return typeof bin === "object" && bin !== null && !Array.isArray(bin) ? Object.keys(bin) : [];
};

const rootScriptCommands = (workspaces: readonly WorkspaceManifest[]): readonly string[] =>
  workspaces
    .filter((workspace) => directoryOf(workspace.file) === "root")
    .flatMap((workspace) => {
      const scripts = field(workspace.manifest, "scripts");
      return typeof scripts === "object" && scripts !== null && !Array.isArray(scripts)
        ? Object.values(scripts).filter((command): command is string => typeof command === "string")
        : [];
    });

const invokedWords = (rootCommands: readonly string[]): ReadonlySet<string> =>
  new Set(rootCommands.flatMap((command) => command.split(/[\s;&|()]+/u)));

const runOnlyByRoot = (input: {
  readonly manifest: unknown;
  readonly consumers: readonly string[];
  readonly imported: readonly string[];
  readonly invoked: ReadonlySet<string>;
}): boolean =>
  input.consumers.length === 1 &&
  input.consumers[0] === "root" &&
  !input.imported.includes("root") &&
  declaredBins(input.manifest).some((bin) => input.invoked.has(bin));

const singleConsumerFindings = (
  workspaces: readonly WorkspaceManifest[],
  sources: readonly SourceText[],
  rootTaskCommands: readonly string[] = [],
): readonly Finding[] => {
  const index = specifierIndex(sources);
  const invoked = invokedWords([...rootScriptCommands(workspaces), ...rootTaskCommands]);
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
      const consumers = [...new Set([...dependencies, ...imported])].sort();
      const packageFinding =
        consumers.length < 2 &&
        !(
          workspace.area === "tools" &&
          runOnlyByRoot({ manifest: workspace.manifest, consumers, imported, invoked })
        )
          ? [
              {
                id: `package:${name}`,
                message: packageMessage(workspace.file, name, consumers),
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

const repositorySingleConsumerFindings: TreeScan<readonly Finding[]> = Effect.map(
  repositorySources(repositoryRoot),
  (sources) =>
    singleConsumerFindings(
      repositoryWorkspaces(),
      sources,
      taskNames(".").flatMap((name) => commands(".", name)),
    ),
);

export { moduleSpecifiers, repositorySingleConsumerFindings, singleConsumerFindings };
export type { Finding, SourceText };
