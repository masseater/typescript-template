#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect, FileSystem, Path, type PlatformError } from "effect";
import { parseSync } from "oxc-parser";

import { directoryEntries } from "../platform/directory-entries.ts";
import { isAppRouteModule } from "./thin-app-routes.ts";

const violation =
  "TanStack Start のルートファイルに JSX を書けません。画面とレイアウトは pages か widgets に移し、createFileRoute には import した component だけを渡してください。";

type RouteScan<Scanned> = Effect.Effect<
  Scanned,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
>;

const collectFiles = (directory: string): RouteScan<readonly string[]> =>
  Effect.gen(function* listRouteFiles() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const nested = yield* Effect.forEach(
      entries,
      (entry): RouteScan<readonly string[]> => {
        const entryPath = paths.join(directory, entry.name);
        if (entry.kind === "directory") {
          return collectFiles(entryPath);
        }
        if (entry.kind === "file" && /\.[cm]?[jt]sx?$/u.test(entry.name)) {
          return Effect.succeed([entryPath]);
        }
        return Effect.succeed([]);
      },
      { concurrency: "unbounded" },
    );
    return nested.flat();
  });

const hasJsx = (source: string, file: string): boolean => {
  const { program } = parseSync(file, source, { lang: file.endsWith("x") ? "tsx" : "ts" });
  const stack: unknown[] = [program];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== "object" || node === null) {
      continue;
    }
    if ("type" in node && (node.type === "JSXElement" || node.type === "JSXFragment")) {
      return true;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        stack.push(...value);
      } else {
        stack.push(value);
      }
    }
  }
  return false;
};

const checkRoutes = (routesRoot: string): RouteScan<readonly string[]> =>
  Effect.gen(function* scan() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const files = yield* collectFiles(routesRoot);
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
