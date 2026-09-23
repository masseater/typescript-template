#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import {
  featureFindings,
  isModularWorkspace,
  isPublicApiIndex,
  layerBudgetFindings,
} from "./modular-budgets.ts";
import { collectSourceFiles } from "./source-files.ts";

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
    const files = yield* collectSourceFiles(directory);
    const counts = yield* Effect.forEach(files, lineCount, { concurrency: "unbounded" });
    return counts.reduce((total, count) => total + count, 0);
  });

const layerLines = (directory: string): Effect.Effect<number> =>
  existsSync(directory) ? directoryLines(directory) : Effect.succeed(0);

const budgetFindings = (srcRoot: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* scan() {
    const [app, shared] = yield* Effect.forEach(["app", "shared"], (layer) =>
      layerLines(join(srcRoot, layer)),
    );
    const featuresRoot = join(srcRoot, "features");
    const entries = existsSync(featuresRoot)
      ? yield* Effect.tryPromise(() => readdir(featuresRoot, { withFileTypes: true }))
      : [];
    const features = yield* Effect.forEach(entries, (entry) =>
      Effect.tryPromise(async () => {
        const names = entry.isDirectory() ? await readdir(join(featuresRoot, entry.name)) : [];
        return {
          directory: entry.isDirectory(),
          name: entry.name,
          publicApi: names.some(isPublicApiIndex),
        };
      }),
    );
    return [
      ...layerBudgetFindings({ app: app ?? 0, shared: shared ?? 0 }),
      ...featureFindings(features),
    ].toSorted();
  });

const program = Effect.gen(function* main() {
  const cwd = process.cwd().replaceAll("\\", "/");
  if (!isModularWorkspace(cwd)) {
    return yield* Effect.fail(new Error(`modular budgets require a modular package cwd: ${cwd}`));
  }
  const target = process.argv[2] ?? "src";
  const srcRoot = join(process.cwd(), target);
  const findings = yield* budgetFindings(srcRoot);
  if (findings.length > 0) {
    yield* Console.error(findings.join("\n"));
    return yield* markFailed;
  }
  yield* Console.log(`modular-budgets: ok (${target})`);
});

void runCli(program, (cause) => causeRecord("quality.modular_budgets_failed", { cause }));
