import { DateTime, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { filesystem, joinPath, makeDirectory, removePath, writeFileString } from "../host.ts";
import { commandIdOf, defaultSpoolRoot, timestampOf } from "./log-destination.ts";

describe("defaultSpoolRoot", () => {
  describe("a start directory nested under an ancestor carrying a package manifest", () => {
    const it = test
      .extend("markedAncestorDirectory", ({}, { onCleanup }) => {
        const madeDirectory = Effect.runPromise(
          filesystem.makeTempDirectory({ prefix: "log-destination-marked-ancestor-" }),
        );
        onCleanup(() =>
          Effect.runPromise(Effect.promise(() => madeDirectory).pipe(Effect.flatMap(removePath))),
        );
        return madeDirectory;
      })
      .extend("spoolRootOfTheNestedStart", ({ markedAncestorDirectory }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const start = joinPath(markedAncestorDirectory, "a", "b");
            yield* makeDirectory(start);
            yield* writeFileString({
              location: joinPath(markedAncestorDirectory, "package.json"),
              written: "{}",
            });
            return yield* defaultSpoolRoot(start);
          }),
        ),
      );

    it("puts the spool beside the manifest that ancestor carries", ({
      markedAncestorDirectory,
      spoolRootOfTheNestedStart,
    }) => {
      expect(spoolRootOfTheNestedStart).toBe(joinPath(markedAncestorDirectory, ".spool"));
    });
  });

  describe("a start directory with no package manifest above it", () => {
    const it = test
      .extend("unmarkedStartDirectory", ({}, { onCleanup }) => {
        const madeDirectory = Effect.runPromise(
          filesystem.makeTempDirectory({ prefix: "log-destination-unmarked-start-" }),
        );
        onCleanup(() =>
          Effect.runPromise(Effect.promise(() => madeDirectory).pipe(Effect.flatMap(removePath))),
        );
        return madeDirectory;
      })
      .extend("spoolRootOfTheUnmarkedStart", ({ unmarkedStartDirectory }) =>
        Effect.runPromise(defaultSpoolRoot(unmarkedStartDirectory)),
      );

    it("puts the spool beside the start directory itself", ({
      spoolRootOfTheUnmarkedStart,
      unmarkedStartDirectory,
    }) => {
      expect(spoolRootOfTheUnmarkedStart).toBe(joinPath(unmarkedStartDirectory, ".spool"));
    });
  });

  describe("a search handed no start directory", () => {
    const it = test.extend("spoolRootOfTheImplicitStart", () =>
      Effect.runPromise(defaultSpoolRoot()));

    it("begins the search at the working directory", ({ spoolRootOfTheImplicitStart }) => {
      expect(spoolRootOfTheImplicitStart).toBe(joinPath(process.cwd(), ".spool"));
    });
  });
});

describe("timestampOf", () => {
  describe("an instant carrying milliseconds", () => {
    const it = test.extend("timestampOfAnInstant", () =>
      timestampOf(DateTime.toDate(DateTime.makeUnsafe("2026-08-12T03:04:05.678Z"))));

    it("drops to seconds in the basic UTC form whose lexical order is time order", ({
      timestampOfAnInstant,
    }) => {
      expect(timestampOfAnInstant).toBe("20260812T030405Z");
    });
  });
});

describe("commandIdOf", () => {
  describe("a command naming its executable by path and carrying several arguments", () => {
    const it = test.extend("commandIdOfACommandGivenByPath", () =>
      commandIdOf(["/usr/local/bin/node", "-e", "ignored third"]));

    it("keeps the base name of the executable and the first argument, normalised into a name", ({
      commandIdOfACommandGivenByPath,
    }) => {
      expect(commandIdOfACommandGivenByPath).toBe("node--e");
    });
  });

  describe("a command carrying an argument longer than an identifier may run", () => {
    const it = test.extend("commandIdOfACommandWithALongArgument", () =>
      commandIdOf(["command", "x".repeat(80)]));

    it("cuts the identifier at 40 characters", ({ commandIdOfACommandWithALongArgument }) => {
      expect(commandIdOfACommandWithALongArgument).toBe("command-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    });
  });
});
