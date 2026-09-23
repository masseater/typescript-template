import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { describe, expect } from "vite-plus/test";

import { filesUnder } from "./directory-entries.ts";
import { path, relativePosixPath } from "./path.ts";

const TOOL_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");

const PLATFORM_DIRECTORY = relativePosixPath(TOOL_ROOT, import.meta.dirname);

const ABSENCE_JUDGEMENTS: readonly RegExp[] = [
  /(?<!\b[A-Z]\w*)\.exists\(/u,
  /"NotFound"/u,
  /[!=]==\s*"E[A-Z]+"/u,
  /"E[A-Z]+"\s*[!=]==/u,
];

const judgesAbsence = (source: string): boolean =>
  ABSENCE_JUDGEMENTS.some((judgement) => judgement.test(source));

const judgingSources = Effect.gen(function* judgingSources() {
  const filesystem = yield* FileSystem.FileSystem;
  const listed = yield* Effect.forEach(["src", "specs"], (directory) =>
    filesUnder({
      directory: path.join(TOOL_ROOT, directory),
      prunedDirectoryNames: ["node_modules", "dist", "coverage"],
      keepsFileName: (fileName) => fileName.endsWith(".ts"),
    }),
  );
  const outsidePlatform = listed
    .flatMap((files) => files ?? [])
    .map((file) => relativePosixPath(TOOL_ROOT, file))
    .filter((file) => !file.startsWith(`${PLATFORM_DIRECTORY}/`));
  const judging = yield* Effect.filter(outsidePlatform, (file) =>
    Effect.map(filesystem.readFileString(path.join(TOOL_ROOT, file)), (source) =>
      judgesAbsence(source),
    ),
  );
  return { scanned: outsidePlatform.length, judging };
});

layer(NodeServices.layer)("absence judgements", (it) => {
  describe("a source judging absence by itself", () => {
    it.effect.each([
      "yield* filesystem.exists(target)",
      'failure.reason._tag === "NotFound"',
      'failureCodeOf(cause) === "ENOENT"',
      '"ENOTDIR" !== code',
    ])("is caught when it spells %s", (source) =>
      Effect.sync(() => {
        expect(judgesAbsence(source)).toBe(true);
      }),
    );
  });

  describe("a source that only mentions absence as data", () => {
    it.effect.each([
      "Option.exists(found, isDirectory)",
      'expect(report).toStrictEqual({ code: "ENOENT" })',
      "yield* pathExists(target)",
    ])("is left alone when it spells %s", (source) =>
      Effect.sync(() => {
        expect(judgesAbsence(source)).toBe(false);
      }),
    );
  });

  describe("every source outside the platform directory", () => {
    it.effect("leaves deciding that a path is not there to the platform", () =>
      Effect.gen(function* program() {
        const { scanned, judging } = yield* judgingSources;
        expect(scanned).toBeGreaterThan(0);
        expect(judging).toStrictEqual([]);
      }),
    );
  });
});
