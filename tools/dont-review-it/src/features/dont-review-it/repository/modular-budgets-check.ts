#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect, FileSystem, Path, Schema } from "effect";
import { sum } from "es-toolkit";

import { directoryEntries } from "../platform/directory-entries.ts";
import { pathExists } from "../platform/file-system.ts";
import {
  featureFindings,
  isModularWorkspace,
  isPublicApiIndex,
  layerBudgetFindings,
} from "./modular-budgets.ts";
import { collectSourceFiles } from "./source-files.ts";

import type { DirectoryEntry, TreeScan } from "../platform/directory-entries.ts";

class NotAModularPackage extends Schema.TaggedError<NotAModularPackage>()("NotAModularPackage", {
  cwd: Schema.String,
}) {
  public override get message(): string {
    return `modular budgets require a modular package cwd: ${this.cwd}`;
  }
}

const lineCount = (file: string): TreeScan<number> =>
  Effect.gen(function* countLines() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(file);
    if (source.length === 0) {
      return 0;
    }
    return source.split(/\r?\n/u).length - (source.endsWith("\n") ? 1 : 0);
  });

const directoryLines = (directory: string): TreeScan<number> =>
  Effect.gen(function* directoryLineTotal() {
    const files = yield* collectSourceFiles(directory);
    const counts = yield* Effect.forEach(files, lineCount, { concurrency: "unbounded" });
    return sum(counts);
  });

const whenPresent = <Scanned>(
  directory: string,
  absent: Scanned,
  scan: (present: string) => TreeScan<Scanned>,
): TreeScan<Scanned> =>
  Effect.gen(function* whenPresent() {
    return (yield* pathExists(directory)) ? yield* scan(directory) : absent;
  });

const featureEntry = (
  featuresRoot: string,
  entry: DirectoryEntry,
): TreeScan<{ readonly directory: boolean; readonly name: string; readonly publicApi: boolean }> =>
  Effect.gen(function* featureEntry() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const directory = entry.kind === "directory";
    const names = directory
      ? yield* filesystem.readDirectory(paths.join(featuresRoot, entry.name))
      : [];
    return { directory, name: entry.name, publicApi: names.some(isPublicApiIndex) };
  });

const budgetFindings = (srcRoot: string): TreeScan<readonly string[]> =>
  Effect.gen(function* scan() {
    const paths = yield* Path.Path;
    const app = yield* whenPresent(paths.join(srcRoot, "app"), 0, directoryLines);
    const shared = yield* whenPresent(paths.join(srcRoot, "shared"), 0, directoryLines);
    const featuresRoot = paths.join(srcRoot, "features");
    const entries = yield* whenPresent(featuresRoot, [], directoryEntries);
    const features = yield* Effect.forEach(entries, (entry) => featureEntry(featuresRoot, entry));
    return [...layerBudgetFindings({ app, shared }), ...featureFindings(features)].toSorted();
  });

const modularPackage = Effect.gen(function* modularPackage() {
  const cwd = process.cwd().replaceAll("\\", "/");
  if (!isModularWorkspace(cwd)) {
    return yield* new NotAModularPackage({ cwd });
  }
  return cwd;
});

const program = Effect.gen(function* main() {
  const paths = yield* Path.Path;
  yield* modularPackage;
  const srcRoot = paths.join(process.cwd(), process.argv[2] ?? "src");
  const findings = yield* budgetFindings(srcRoot);
  if (findings.length > 0) {
    yield* Console.error(findings.join("\n"));
    return yield* markFailed;
  }
  yield* Console.log(`modular-budgets: ok (${paths.relative(process.cwd(), srcRoot) || "."})`);
});

runCli(program.pipe(Effect.provide(NodeServices.layer)), (cause) =>
  causeRecord("quality.modular_budgets_failed", { cause }),
);
