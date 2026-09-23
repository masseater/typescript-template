#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { architectureKindOf, modularBudgets } from "@repo/config";
import { Console, Effect, FileSystem, Path, Schema, type PlatformError } from "effect";

import { directoryEntries } from "./directory-entries.ts";

const sourceSuffix = /\.[cm]?[jt]sx?$/u;

type SourceScan<Scanned> = Effect.Effect<
  Scanned,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
>;

class NotAModularPackage extends Schema.TaggedError<NotAModularPackage>()("NotAModularPackage", {
  cwd: Schema.String,
}) {
  public override get message(): string {
    return `modular budgets require a modular package cwd: ${this.cwd}`;
  }
}

const collectFiles = (directory: string): SourceScan<readonly string[]> =>
  Effect.gen(function* listFiles() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const nested = yield* Effect.forEach(
      entries,
      (entry): SourceScan<readonly string[]> => {
        const entryPath = paths.join(directory, entry.name);
        if (entry.kind === "directory") {
          return collectFiles(entryPath);
        }
        if (entry.kind === "file" && sourceSuffix.test(entry.name)) {
          return Effect.succeed([entryPath]);
        }
        return Effect.succeed([]);
      },
      { concurrency: "unbounded" },
    );
    return nested.flat();
  });

const lineCount = (file: string): SourceScan<number> =>
  Effect.gen(function* countLines() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(file);
    if (source.length === 0) {
      return 0;
    }
    return source.split(/\r?\n/u).length - (source.endsWith("\n") ? 1 : 0);
  });

const directoryLines = (directory: string): SourceScan<number> =>
  Effect.gen(function* sum() {
    const files = yield* collectFiles(directory);
    const counts = yield* Effect.forEach(files, lineCount, { concurrency: "unbounded" });
    return counts.reduce((total, count) => total + count, 0);
  });

const whenPresent = <Scanned>(
  directory: string,
  absent: Scanned,
  scan: (present: string) => SourceScan<Scanned>,
): SourceScan<Scanned> =>
  Effect.gen(function* whenPresent() {
    const filesystem = yield* FileSystem.FileSystem;
    return (yield* filesystem.exists(directory)) ? yield* scan(directory) : absent;
  });

const budgetFindings = (srcRoot: string): SourceScan<readonly string[]> =>
  Effect.gen(function* scan() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const findings: string[] = [];
    const appLines = yield* whenPresent(paths.join(srcRoot, "app"), 0, directoryLines);
    if (appLines > modularBudgets.app) {
      findings.push(
        `app: ${appLines} lines exceeds ${modularBudgets.app}. Move composition out into features/<name>.`,
      );
    }
    const sharedLines = yield* whenPresent(paths.join(srcRoot, "shared"), 0, directoryLines);
    if (sharedLines > modularBudgets.shared) {
      findings.push(
        `shared: ${sharedLines} lines exceeds ${modularBudgets.shared}. Extract a features/<name> slice.`,
      );
    }
    const featureEntries = yield* whenPresent(
      paths.join(srcRoot, "features"),
      [],
      directoryEntries,
    );
    for (const entry of featureEntries) {
      if (entry.kind !== "directory") {
        findings.push(`features/${entry.name}: place slice code in a directory, not a loose file.`);
        continue;
      }
      const sliceRoot = paths.join(srcRoot, "features", entry.name);
      const hasPublicApi = (yield* filesystem.readDirectory(sliceRoot)).some((name) =>
        /^index\.[cm]?[jt]sx?$/u.test(name),
      );
      if (!hasPublicApi) {
        findings.push(
          `features/${entry.name}: missing public API index (features/${entry.name}/index.ts).`,
        );
      }
    }
    return findings.toSorted();
  });

const program = Effect.gen(function* main() {
  const paths = yield* Path.Path;
  const cwd = process.cwd().replaceAll("\\", "/");
  const workspacePath = ["apps", "libs", "tools", "infra"]
    .map((area) => {
      const marker = `/${area}/`;
      const index = cwd.lastIndexOf(marker);
      if (index < 0) {
        return undefined;
      }
      const rest = cwd.slice(index + 1);
      const [root, name] = rest.split("/");
      return root !== undefined && name !== undefined ? `${root}/${name}` : undefined;
    })
    .find((value) => value !== undefined);
  if (workspacePath === undefined || architectureKindOf(workspacePath) !== "modular") {
    return yield* new NotAModularPackage({ cwd });
  }
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
