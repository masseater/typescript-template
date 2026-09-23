import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  externalRecordKeyOf,
  externalRecordOf,
  MAX_INLINE_RECORD_LINES,
  recordLineCountOf,
} from "./snapshot-records.ts";

describe("externalRecordKeyOf", () => {
  describe("a title path and an ordinal", () => {
    const it = test.extend("recordKey", () =>
      externalRecordKeyOf(["outer", "names a behaviour"], 2));

    it("joins the enclosing titles and ends with the ordinal", ({ recordKey }) => {
      expect(recordKey).toBe("outer > names a behaviour 2");
    });
  });
});

layer(NodeServices.layer)("externalRecordOf", (it) => {
  describe("a record written on one line", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const storedSingleLineSnapshot = yield* Effect.gen(function* storedSingleLineSnapshot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(snapshotRecordsRoot, "one-line");
        yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
          [
            "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
            "",
            'exports[`outer > names a behaviour 1`] = `"alpha"`;',
            "",
            "exports[`outer > names a behaviour 2`] = `",
            "{",
            '  "alpha": 1,',
            "}",
            "`;",
            "",
          ].join("\n"),
        );
        return externalRecordOf(
          paths.join(directory, "subject.test.ts"),
          "outer > names a behaviour 1",
        );
      });
      return { snapshotRecordsRoot, storedSingleLineSnapshot };
    });

    it.effect("is read back whole", () =>
      Effect.gen(function* program() {
        const { storedSingleLineSnapshot } = yield* fixtures;
        expect(storedSingleLineSnapshot).toBe('"alpha"');
      }),
    );
  });

  describe("a record written across lines", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const storedMultiLineSnapshot = yield* Effect.gen(function* storedMultiLineSnapshot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(snapshotRecordsRoot, "across-lines");
        yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
          [
            "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
            "",
            'exports[`outer > names a behaviour 1`] = `"alpha"`;',
            "",
            "exports[`outer > names a behaviour 2`] = `",
            "{",
            '  "alpha": 1,',
            "}",
            "`;",
            "",
          ].join("\n"),
        );
        return externalRecordOf(
          paths.join(directory, "subject.test.ts"),
          "outer > names a behaviour 2",
        );
      });
      return { snapshotRecordsRoot, storedMultiLineSnapshot };
    });

    it.effect("keeps the padding the runner wrote", () =>
      Effect.gen(function* program() {
        const { storedMultiLineSnapshot } = yield* fixtures;
        expect(storedMultiLineSnapshot).toBe('\n{\n  "alpha": 1,\n}\n');
      }),
    );
  });

  describe("a key the file does not carry", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const snapshotForAbsentKey = yield* Effect.gen(function* snapshotForAbsentKey() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(snapshotRecordsRoot, "other-key");
        yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
          [
            "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
            "",
            'exports[`outer > names a behaviour 1`] = `"alpha"`;',
            "",
            "exports[`outer > names a behaviour 2`] = `",
            "{",
            '  "alpha": 1,',
            "}",
            "`;",
            "",
          ].join("\n"),
        );
        return externalRecordOf(
          paths.join(directory, "subject.test.ts"),
          "outer > some other behaviour 1",
        );
      });
      return { snapshotRecordsRoot, snapshotForAbsentKey };
    });

    it.effect("reads as no record", () =>
      Effect.gen(function* program() {
        const { snapshotForAbsentKey } = yield* fixtures;
        expect(snapshotForAbsentKey).toBe(null);
      }),
    );
  });

  describe("a spec with no record file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const snapshotForSpecWithoutRecordFile = yield* Effect.gen(
        function* snapshotForSpecWithoutRecordFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(snapshotRecordsRoot, "absent");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          return externalRecordOf(
            paths.join(directory, "subject.test.ts"),
            "outer > names a behaviour 1",
          );
        },
      );
      return { snapshotRecordsRoot, snapshotForSpecWithoutRecordFile };
    });

    it.effect("reads as no record", () =>
      Effect.gen(function* program() {
        const { snapshotForSpecWithoutRecordFile } = yield* fixtures;
        expect(snapshotForSpecWithoutRecordFile).toBe(null);
      }),
    );
  });

  describe("an escaped delimiter inside a record", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const snapshotCarryingEscapedDelimiters = yield* Effect.gen(
        function* snapshotCarryingEscapedDelimiters() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(snapshotRecordsRoot, "escaped");
          yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
            [
              "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
              "",
              "exports[`outer > carries delimiters 1`] = `",
              '"line one',
              "exports[\\`decoy > key 1\\`] = \\`tricked\\`;",
              'line three"',
              "`;",
              "",
              'exports[`outer > after the decoy 1`] = `"beta"`;',
              "",
            ].join("\n"),
          );
          return externalRecordOf(
            paths.join(directory, "subject.test.ts"),
            "outer > carries delimiters 1",
          );
        },
      );
      return { snapshotRecordsRoot, snapshotCarryingEscapedDelimiters };
    });

    it.effect("does not end the record", () =>
      Effect.gen(function* program() {
        const { snapshotCarryingEscapedDelimiters } = yield* fixtures;
        expect(snapshotCarryingEscapedDelimiters).toBe(
          '\n"line one\nexports[`decoy > key 1`] = `tricked`;\nline three"\n',
        );
      }),
    );
  });

  describe("a record carrying a decoy key", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const snapshotAfterTheDecoy = yield* Effect.gen(function* snapshotAfterTheDecoy() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(snapshotRecordsRoot, "after-decoy");
        yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
          [
            "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
            "",
            "exports[`outer > carries delimiters 1`] = `",
            '"line one',
            "exports[\\`decoy > key 1\\`] = \\`tricked\\`;",
            'line three"',
            "`;",
            "",
            'exports[`outer > after the decoy 1`] = `"beta"`;',
            "",
          ].join("\n"),
        );
        return externalRecordOf(
          paths.join(directory, "subject.test.ts"),
          "outer > after the decoy 1",
        );
      });
      return { snapshotRecordsRoot, snapshotAfterTheDecoy };
    });

    it.effect("does not hide the record that follows it", () =>
      Effect.gen(function* program() {
        const { snapshotAfterTheDecoy } = yield* fixtures;
        expect(snapshotAfterTheDecoy).toBe('"beta"');
      }),
    );
  });

  describe("the decoy key inside a record", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const snapshotRecordsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-snapshot-records-",
      });
      const snapshotForDecoyKey = yield* Effect.gen(function* snapshotForDecoyKey() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const directory = paths.join(snapshotRecordsRoot, "decoy");
        yield* filesystem.makeDirectory(paths.join(directory, "__snapshots__"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(directory, "__snapshots__", "subject.test.ts.snap"),
          [
            "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
            "",
            "exports[`outer > carries delimiters 1`] = `",
            '"line one',
            "exports[\\`decoy > key 1\\`] = \\`tricked\\`;",
            'line three"',
            "`;",
            "",
            'exports[`outer > after the decoy 1`] = `"beta"`;',
            "",
          ].join("\n"),
        );
        return externalRecordOf(paths.join(directory, "subject.test.ts"), "decoy > key 1");
      });
      return { snapshotRecordsRoot, snapshotForDecoyKey };
    });

    it.effect("is not a key of its own", () =>
      Effect.gen(function* program() {
        const { snapshotForDecoyKey } = yield* fixtures;
        expect(snapshotForDecoyKey).toBe(null);
      }),
    );
  });
});

describe("recordLineCountOf", () => {
  describe("a record written on one line", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf('"alpha"'));

    it("counts as one line", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(1);
    });
  });

  describe("an empty record", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf(""));

    it("counts as one line", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(1);
    });
  });

  describe("a record written across lines", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf('\n{\n  "alpha": 1,\n}\n'));

    it("does not count the padding the runner adds around it", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(3);
    });
  });

  describe("a record carrying carriage returns", () => {
    const it = test.extend("recordLineCount", () =>
      recordLineCountOf('\r\n{\r\n  "alpha": 1,\r\n}\r\n'));

    it("counts the same as one without them", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(3);
    });
  });
});

describe("MAX_INLINE_RECORD_LINES", () => {
  describe("the budget both placement rules read", () => {
    const it = test.extend("inlineRecordBudget", () => MAX_INLINE_RECORD_LINES);

    it("is the one shared number", ({ inlineRecordBudget }) => {
      expect(inlineRecordBudget).toBe(12);
    });
  });
});
