#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect } from "effect";
import { parseSync } from "oxc-parser";

import { isAppRouteModule } from "./thin-app-routes.ts";

const violation =
  "TanStack Start のルートファイルに JSX を書けません。画面とレイアウトは pages か widgets に移し、createFileRoute には import した component だけを渡してください。";

const collectFiles = (directory: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* listRouteFiles() {
    const entries = yield* Effect.orDie(
      Effect.tryPromise(() => readdir(directory, { withFileTypes: true })),
    );
    const nested = yield* Effect.forEach(
      entries,
      (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return collectFiles(path);
        }
        if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) {
          return Effect.succeed([path] as const);
        }
        return Effect.succeed([] as const);
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

const checkRoutes = (routesRoot: string): Effect.Effect<readonly string[]> =>
  Effect.gen(function* scan() {
    const files = yield* collectFiles(routesRoot);
    const findings = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* inspect() {
          if (!isAppRouteModule(file.replaceAll("\\", "/"))) {
            return undefined;
          }
          const source = yield* Effect.orDie(Effect.tryPromise(() => readFile(file, "utf8")));
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

runCli(program.pipe(Effect.asVoid), (cause) =>
  causeRecord("quality.thin_app_routes_failed", { cause }),
);
