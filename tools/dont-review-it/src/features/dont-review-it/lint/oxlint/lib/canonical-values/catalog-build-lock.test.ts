import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Option, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { readGitSourceScope } from "../git-ignored-source.ts";
import { cacheInputFingerprint, writeCachedEntries } from "./catalog-cache.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const ORDER_STATUS_DRAFT_ONLY = `/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const LOCK_HOLDER = [
  "const { existsSync } = await import('node:fs');",
  "const { underCatalogBuildLock } = await import(process.argv[1]);",
  "const pause = new Int32Array(new SharedArrayBuffer(4));",
  "underCatalogBuildLock(process.argv[2], () => {",
  "  process.stdout.write('held\\n');",
  "  while (!existsSync(process.argv[3])) Atomics.wait(pause, 0, 0, 20);",
  "});",
].join("\n");

const CATALOG_READER = [
  "const { loadCanonicalValuesCatalogSnapshot } = await import(process.argv[1]);",
  "process.stderr.write('loading\\n');",
  "const catalog = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: process.argv[2] });",
  "process.stdout.write(JSON.stringify(catalog.entries.map((entry) => entry.values)));",
].join("\n");

const moduleScript = (script: string, moduleArguments: readonly string[]) =>
  ChildProcess.make(process.execPath, [
    "--input-type=module",
    "--eval",
    script,
    ...moduleArguments,
  ]);

const plantedOrderStatusEntry = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 60,
  conceptId: "order.status",
  declarationEnd: 90,
  declarationPath: "src/order-status.ts",
  declarationStart: 45,
  fingerprint: fingerprintValues(["published"]),
  importRoutes: [],
  packageName: null,
  values: ["published"],
};

layer(NodeServices.layer, { excludeTestServices: true })("underCatalogBuildLock", (it) => {
  describe("a catalog build that meets the build lock held by another process", () => {
    const fixture = Effect.gen(function* whatTheWaitingBuildDid() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-build-lock-" });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src", "order-status.ts"),
        ORDER_STATUS_DRAFT_ONLY,
      );

      const releaseSignal = paths.join(root, "release");
      const holder = yield* spawner.spawn(
        moduleScript(LOCK_HOLDER, [
          import.meta.resolve("./catalog-build-lock.ts"),
          root,
          releaseSignal,
        ]),
      );
      yield* Stream.runHead(Stream.decodeText(holder.stdout));
      const reader = yield* spawner.spawn(
        moduleScript(CATALOG_READER, [import.meta.resolve("./builder.ts"), root]),
      );
      yield* Stream.runHead(Stream.decodeText(reader.stderr));
      const exitedWhileHeld = yield* Effect.timeoutOption(reader.exitCode, "2 seconds");

      const repositoryFiles = listRepositoryFiles(root, readGitSourceScope(root));
      writeCachedEntries(root, {
        fingerprint: cacheInputFingerprint(repositoryFiles.cacheInputs, repositoryFiles.problems),
        entries: [plantedOrderStatusEntry],
      });
      yield* filesystem.writeFileString(releaseSignal, "");
      yield* holder.exitCode;

      return {
        exitedWhileHeld: Option.isSome(exitedWhileHeld),
        handedBack: yield* Stream.mkString(Stream.decodeText(reader.stdout)),
      };
    }).pipe(Effect.scoped);

    it.effect("waits for the holder and hands back the catalog it wrote", () =>
      Effect.gen(function* program() {
        const whatTheWaitingBuildDid = yield* fixture;
        expect(whatTheWaitingBuildDid).toStrictEqual({
          exitedWhileHeld: false,
          handedBack: '[["published"]]',
        });
      }),
    );
  });
});
