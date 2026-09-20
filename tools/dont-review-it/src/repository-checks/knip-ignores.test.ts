import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import knipConfig from "../../../../knip.ts";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const SKIPPED_DIRECTORIES = new Set([".git", ".local", "coverage", "dist", "node_modules"]);

type WorkspaceKnip = {
  readonly ignoreBinaries?: readonly string[];
  readonly ignoreDependencies?: readonly string[];
  readonly workspaces?: Readonly<Record<string, WorkspaceKnip>>;
};

type IgnoreKind = "ignoreBinaries" | "ignoreDependencies";

type ListedIgnore = {
  readonly kind: IgnoreKind;
  readonly name: string;
  readonly workspace: string;
};

const reportedConfigs = [
  knipConfig({ production: false, strict: false }),
  knipConfig({ production: true, strict: true }),
] as readonly WorkspaceKnip[];

const bareNameOf = (listed: string): string => listed.replace(/!$/u, "");

const listedIn = (config: WorkspaceKnip, kind: IgnoreKind): readonly string[] => config[kind] ?? [];

const ignoresIn = (): readonly ListedIgnore[] => {
  const listed = new Map<string, ListedIgnore>();
  for (const config of reportedConfigs) {
    for (const kind of ["ignoreDependencies", "ignoreBinaries"] as const) {
      for (const name of listedIn(config, kind)) {
        const row = { kind, name: bareNameOf(name), workspace: "." };
        listed.set(`${row.workspace}\0${row.kind}\0${row.name}`, row);
      }
    }
    for (const [workspace, workspaceConfig] of Object.entries(config.workspaces ?? {})) {
      for (const kind of ["ignoreDependencies", "ignoreBinaries"] as const) {
        for (const name of listedIn(workspaceConfig, kind)) {
          const row = { kind, name: bareNameOf(name), workspace };
          listed.set(`${row.workspace}\0${row.kind}\0${row.name}`, row);
        }
      }
    }
  }
  return [...listed.values()];
};

const extensionOf = (file: string): string => {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
};

const filesUnder = (directory: string, nested: boolean): readonly string[] => {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return nested ? filesUnder(path, true) : [];
    if (!TEXT_EXTENSIONS.has(extensionOf(entry.name))) return [];
    if (entry.name === "pnpm-lock.yaml") return [];
    return [path];
  });
};

const workspaceDirectories = (workspace: string): readonly string[] => {
  if (workspace === ".") return [repositoryRoot];
  if (!workspace.includes("*")) return [join(repositoryRoot, workspace)];
  const parent = workspace.slice(0, workspace.indexOf("*")).replace(/\/$/u, "");
  return readdirSync(join(repositoryRoot, parent), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? [join(repositoryRoot, parent, entry.name)] : [],
  );
};

const SPECIFIER = /(?:from\s+|import\s*\(\s*|require\(\s*|import\s+)["']([^"']+)["']/gu;

const SPAWN = /(?:spawnSync|spawn|execFileSync|execFile)\(\s*["']([^"']+)["']/gu;

const COMMAND = /(?:command["']?\s*:\s*|^\s*"[^"]+"\s*:\s*)["'`]([^"'`]+)["'`]/gmu;

const specifiersIn = (text: string): readonly string[] =>
  [...text.matchAll(SPECIFIER)].map((match) => match[1] ?? "");

const insideRepository = (file: string): boolean => {
  const fromRoot = relative(repositoryRoot, file);
  return fromRoot !== "" && !fromRoot.startsWith("..") && !fromRoot.includes("node_modules");
};

const resolvedSpecifier = (fromFile: string, specifier: string): string | null => {
  const local =
    specifier.startsWith(".") || specifier.startsWith("@repo/") || specifier.startsWith("#");
  if (!local) return null;
  try {
    const resolved = createRequire(fromFile).resolve(specifier);
    return insideRepository(resolved) ? resolved : null;
  } catch {
    return null;
  }
};

const followedFiles = (roots: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const pending = [...roots];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || seen.has(file) || !insideRepository(file)) continue;
    seen.add(file);
    if (relative(repositoryRoot, file) === "knip.ts") continue;
    const text = readFileSync(file, "utf8");
    for (const specifier of specifiersIn(text)) {
      const resolved = resolvedSpecifier(file, specifier);
      if (resolved !== null) pending.push(resolved);
    }
  }
  return [...seen];
};

const filesByDirectory = new Map<string, readonly string[]>();

const filesForDirectory = (directory: string, nested: boolean): readonly string[] => {
  const key = `${directory}\0${String(nested)}`;
  const cached = filesByDirectory.get(key);
  if (cached !== undefined) return cached;
  const owned = filesUnder(directory, nested).filter(
    (file) => relative(repositoryRoot, file) !== "knip.ts",
  );
  const roots = owned.filter((file) => [".js", ".mjs", ".ts", ".tsx"].includes(extensionOf(file)));
  const files = [...new Set([...owned, ...followedFiles(roots)])];
  filesByDirectory.set(key, files);
  return files;
};

const binsOf = (workspaceDir: string, name: string): ReadonlySet<string> => {
  try {
    const manifest = createRequire(join(workspaceDir, "package.json")).resolve(
      `${name}/package.json`,
    );
    const declared: unknown = JSON.parse(readFileSync(manifest, "utf8")).bin;
    if (typeof declared === "string") {
      const executable = name.split("/").at(-1);
      return executable === undefined ? new Set() : new Set([executable]);
    }
    if (typeof declared === "object" && declared !== null) {
      return new Set(Object.keys(declared));
    }
  } catch {
    return new Set();
  }
  return new Set();
};

const tokenOf = (name: string): RegExp =>
  new RegExp(
    `(?:^|[^\\w@./-])${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:$|[^\\w@./-])`,
    "u",
  );

const scriptTextOf = (file: string, text: string): string => {
  if (!file.endsWith("package.json")) return "";
  const declared: unknown = JSON.parse(text).scripts;
  if (typeof declared !== "object" || declared === null) return "";
  return Object.values(declared)
    .filter((script) => typeof script === "string")
    .join("\n");
};

const mentionsPackage = ({
  bins,
  file,
  name,
  text,
}: {
  readonly bins: ReadonlySet<string>;
  readonly file: string;
  readonly name: string;
  readonly text: string;
}): boolean => {
  if (
    specifiersIn(text).some((specifier) => specifier === name || specifier.startsWith(`${name}/`))
  ) {
    return true;
  }
  const commands = [
    scriptTextOf(file, text),
    ...[...text.matchAll(COMMAND)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(SPAWN)].map((match) => match[1] ?? ""),
  ].join("\n");
  if (tokenOf(name).test(commands) || [...bins].some((bin) => tokenOf(bin).test(commands))) {
    return true;
  }
  if (file.endsWith("package.json")) return false;
  return tokenOf(name).test(text);
};

const unusedIgnores = (): readonly string[] =>
  ignoresIn().flatMap((ignore) =>
    workspaceDirectories(ignore.workspace).flatMap((directory) => {
      const bins = binsOf(directory, ignore.name);
      const used = filesForDirectory(directory, ignore.workspace !== ".").some((file) =>
        mentionsPackage({ bins, file, name: ignore.name, text: readFileSync(file, "utf8") }),
      );
      return used ? [] : [`${ignore.workspace} ${ignore.kind} ${ignore.name}`];
    }),
  );

describe("knip ignore entries", () => {
  it("names a dependency or binary the workspace imports, spawns, or runs", () => {
    expect.hasAssertions();
    expect(unusedIgnores()).toStrictEqual([]);
  });

  it("does not treat a name with no import, spawn, or command as a reason to ignore it", () => {
    expect.hasAssertions();
    const bins = new Set<string>();
    const mentioned = filesForDirectory(repositoryRoot, false).some((file) =>
      mentionsPackage({
        bins,
        file,
        name: "package-nobody-imports-or-runs",
        text: readFileSync(file, "utf8"),
      }),
    );
    expect(mentioned).toBe(false);
  });
});
