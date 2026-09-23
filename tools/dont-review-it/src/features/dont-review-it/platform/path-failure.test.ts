// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readFileSync, statSync } from "node:fs";

import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { failureCodeOf, readUnlessMissing } from "./path-failure.ts";

class RuntimeRefusal extends Schema.TaggedError<RuntimeRefusal>()("RuntimeRefusal", {
  code: Schema.Union([Schema.String, Schema.Finite]),
}) {}

class UncodedFailure extends Schema.TaggedError<UncodedFailure>()("UncodedFailure", {}) {}

const presentFile = Effect.gen(function* presentFile() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "path-failure-" });
  const presentPath = paths.join(root, "present.txt");
  yield* filesystem.writeFileString(presentPath, "written");
  return { presentPath, root };
});

const raisedBy = (thrown: unknown): unknown => {
  const [failure] = attempt<unknown, unknown>(() =>
    readUnlessMissing(() => {
      throw thrown;
    }),
  );
  return failure;
};

layer(NodeServices.layer)("readUnlessMissing", (it) => {
  describe("a read that succeeds", () => {
    it.effect("hands back what it read", () =>
      Effect.gen(function* program() {
        const { presentPath } = yield* presentFile;
        expect(readUnlessMissing(() => readFileSync(presentPath, "utf8"))).toBe("written");
      }),
    );
  });

  describe("a path that does not exist", () => {
    it.effect("is an absence rather than a failure", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { root } = yield* presentFile;
        expect(readUnlessMissing(() => statSync(paths.join(root, "absent.txt")))).toBe(null);
      }),
    );
  });

  describe("a path routed through a file instead of a directory", () => {
    it.effect("is an absence as well", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { presentPath } = yield* presentFile;
        expect(readUnlessMissing(() => statSync(paths.join(presentPath, "below.txt")))).toBe(null);
      }),
    );
  });
});

describe("readUnlessMissing", () => {
  describe("a path that exists but cannot be read", () => {
    const refusal = new RuntimeRefusal({ code: "EACCES" });
    const it = test.extend("raisedRefusal", () => raisedBy(refusal));

    it("is raised instead of becoming an absence", ({ raisedRefusal }) => {
      expect(raisedRefusal).toBe(refusal);
    });
  });

  describe("a failure the runtime did not raise", () => {
    const uncoded = new UncodedFailure();
    const it = test.extend("raisedUncoded", () => raisedBy(uncoded));

    it("is passed on untouched", ({ raisedUncoded }) => {
      expect(raisedUncoded).toBe(uncoded);
    });
  });

  describe("a failure whose code is not a word", () => {
    const numbered = new RuntimeRefusal({ code: 7 });
    const it = test.extend("raisedNumbered", () => raisedBy(numbered));

    it("is raised rather than becoming an absence", ({ raisedNumbered }) => {
      expect(raisedNumbered).toBe(numbered);
    });
  });
});

describe("failureCodeOf", () => {
  describe("a failure carrying a worded code", () => {
    const it = test.extend("code", () => failureCodeOf(new RuntimeRefusal({ code: "EROFS" })));

    it("hands the code back", ({ code }) => {
      expect(code).toBe("EROFS");
    });
  });

  describe("a failure carrying no code", () => {
    const it = test.extend("code", () =>
      failureCodeOf(new TypeError("cannot serialise a function")));

    it("has nothing to hand back", ({ code }) => {
      expect(code).toBe(null);
    });
  });

  describe("a thrown value that is not an object", () => {
    const it = test.extend("code", () => failureCodeOf("EROFS"));

    it("carries nothing to classify", ({ code }) => {
      expect(code).toBe(null);
    });
  });
});
