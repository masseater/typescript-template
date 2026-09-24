#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect, FileSystem, Path } from "effect";
import { parseSync } from "oxc-parser";

import { collectSourceFiles } from "./source-files.ts";
import { containsJsx, isAppRouteModule } from "./thin-app-routes.ts";

import type { TreeScan } from "../platform/directory-entries.ts";

const violation =
  "TanStack Start のルートファイルに JSX を書けません。画面とレイアウトは pages か widgets に移し、createFileRoute には import した component だけを渡してください。";

const hasJsx = (source: string, file: string): boolean =>
  containsJsx(parseSync(file, source, { lang: file.endsWith("x") ? "tsx" : "ts" }).program);

const checkRoutes = (routesRoot: string): TreeScan<readonly string[]> =>
  Effect.gen(function* scan() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const files = yield* collectSourceFiles(routesRoot);
    const findings = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* inspect() {
          if (!isAppRouteModule(file.replaceAll("\\", "/"))) {
            return undefined;
          }
          const source = yield* filesystem.readFileString(file);
          if (!hasJsx(source, file)) {
            return undefined;
          }
          return `${paths.relative(process.cwd(), file).replaceAll("\\", "/")}: ${violation}`;
        }),
      { concurrency: "unbounded" },
    );
    return findings.filter((line): line is string => line !== undefined).toSorted();
  });

const program = Effect.gen(function* main() {
  const paths = yield* Path.Path;
  const routesRoot = paths.join(process.cwd(), process.argv[2] ?? "src/app/routes");
  const findings = yield* checkRoutes(routesRoot);
  if (findings.length > 0) {
    yield* Console.error(findings.join("\n"));
    return yield* markFailed;
  }
  yield* Console.log(`thin-app-routes: ok (${paths.relative(process.cwd(), routesRoot) || "."})`);
});

runCli(program.pipe(Effect.provide(NodeServices.layer)), (cause) =>
  causeRecord("quality.thin_app_routes_failed", { cause }),
);
