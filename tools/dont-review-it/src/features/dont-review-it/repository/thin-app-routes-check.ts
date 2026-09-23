#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect } from "effect";
import { parseSync } from "oxc-parser";

import { collectSourceFiles } from "./source-files.ts";
import { containsJsx, isAppRouteModule } from "./thin-app-routes.ts";

const violation =
  "TanStack Start のルートファイルに JSX を書けません。画面とレイアウトは pages か widgets に移し、createFileRoute には import した component だけを渡してください。";

const hasJsx = (source: string, file: string): boolean =>
  containsJsx(parseSync(file, source, { lang: file.endsWith("x") ? "tsx" : "ts" }).program);

const checkRoutes = (routesRoot: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* scan() {
    const files = yield* collectSourceFiles(routesRoot);
    const findings = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* inspect() {
          if (!isAppRouteModule(file.replaceAll("\\", "/"))) {
            return undefined;
          }
          const source = yield* Effect.tryPromise(() => readFile(file, "utf8"));
          if (!hasJsx(source, file)) {
            return undefined;
          }
          return `${relative(process.cwd(), file).replaceAll("\\", "/")}: ${violation}`;
        }),
      { concurrency: "unbounded" },
    );
    return findings.filter((line): line is string => line !== undefined).toSorted();
  });

const program = Effect.gen(function* main() {
  const routesRoot = join(process.cwd(), process.argv[2] ?? "src/app/routes");
  const findings = yield* checkRoutes(routesRoot);
  if (findings.length > 0) {
    yield* Console.error(findings.join("\n"));
    return yield* markFailed;
  }
  yield* Console.log(`thin-app-routes: ok (${relative(process.cwd(), routesRoot) || "."})`);
});

void runCli(
  program.pipe(
    Effect.tapError((error) => Console.error(JSON.stringify(causeRecord(error)))),
    Effect.asVoid,
  ),
);
