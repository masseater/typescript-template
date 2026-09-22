#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { architectureKindOf, modularBudgets } from "@repo/config";
import { Console, Effect } from "effect";

const sourceSuffix = /\.[cm]?[jt]sx?$/u;

const collectFiles = (directory: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* listFiles() {
    const entries = yield* Effect.tryPromise(() => readdir(directory, { withFileTypes: true }));
    const nested = yield* Effect.forEach(
      entries,
      (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return collectFiles(path);
        }
        if (entry.isFile() && sourceSuffix.test(entry.name)) {
          return Effect.succeed([path] as const);
        }
        return Effect.succeed([] as const);
      },
      { concurrency: "unbounded" },
    );
    return nested.flat();
  });

const lineCount = (file: string): Effect.Effect<number> =>
  Effect.gen(function* countLines() {
    const source = yield* Effect.tryPromise(() => readFile(file, "utf8"));
    if (source.length === 0) {
      return 0;
    }
    return source.split(/\r?\n/u).length - (source.endsWith("\n") ? 1 : 0);
  });

const directoryLines = (directory: string): Effect.Effect<number> =>
  Effect.gen(function* sum() {
    const files = yield* collectFiles(directory);
    const counts = yield* Effect.forEach(files, lineCount, { concurrency: "unbounded" });
    return counts.reduce((total, count) => total + count, 0);
  });

const budgetFindings = (srcRoot: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* scan() {
    const findings: string[] = [];
    const appLines = yield* directoryLines(join(srcRoot, "app")).pipe(
      Effect.orElseSucceed(() => 0),
    );
    if (appLines > modularBudgets.app) {
      findings.push(
        `app: ${appLines} lines exceeds ${modularBudgets.app}. Move composition out into features/<name>.`,
      );
    }
    const sharedLines = yield* directoryLines(join(srcRoot, "shared")).pipe(
      Effect.orElseSucceed(() => 0),
    );
    if (sharedLines > modularBudgets.shared) {
      findings.push(
        `shared: ${sharedLines} lines exceeds ${modularBudgets.shared}. Extract a features/<name> slice.`,
      );
    }
    const featureEntries = yield* Effect.tryPromise(() =>
      readdir(join(srcRoot, "features"), { withFileTypes: true }),
    ).pipe(Effect.orElseSucceed(() => []));
    for (const entry of featureEntries) {
      if (!entry.isDirectory()) {
        findings.push(`features/${entry.name}: place slice code in a directory, not a loose file.`);
        continue;
      }
      const sliceRoot = join(srcRoot, "features", entry.name);
      const hasPublicApi = yield* Effect.tryPromise(async () => {
        const names = await readdir(sliceRoot);
        return names.some((name) => /^index\.[cm]?[jt]sx?$/u.test(name));
      }).pipe(Effect.orElseSucceed(false));
      if (!hasPublicApi) {
        findings.push(
          `features/${entry.name}: missing public API index (features/${entry.name}/index.ts).`,
        );
      }
    }
    return findings.toSorted();
  });

const program = Effect.gen(function* main() {
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
    return yield* Effect.fail(new Error(`modular budgets require a modular package cwd: ${cwd}`));
  }
  const srcRoot = join(process.cwd(), process.argv[2] ?? "src");
  const findings = yield* budgetFindings(srcRoot);
  if (findings.length > 0) {
    yield* Console.error(findings.join("\n"));
    return yield* markFailed;
  }
  yield* Console.log(`modular-budgets: ok (${relative(process.cwd(), srcRoot) || "."})`);
});

void runCli(program, (cause) => causeRecord("quality.modular_budgets_failed", { cause }));
