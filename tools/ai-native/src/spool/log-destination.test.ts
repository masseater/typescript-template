import { describe, expect, test } from "vite-plus/test";

import {
  dateFrom,
  joinPath,
  makeDirectory,
  makeTempDirectory,
  removePath,
  writeFileString,
} from "../host.ts";
import { commandIdOf, defaultSpoolRoot, timestampOf } from "./log-destination.ts";

describe("defaultSpoolRoot", () => {
  describe("a start directory nested under an ancestor carrying a package manifest", () => {
    const markedAncestorDirectory = makeTempDirectory("log-destination-marked-ancestor-");

    const it = test.extend("spoolRootOfTheNestedStart", ({}, { onCleanup }) => {
      const start = joinPath(markedAncestorDirectory, "a", "b");
      makeDirectory(start);
      onCleanup(() => {
        removePath(markedAncestorDirectory);
      });
      writeFileString({
        location: joinPath(markedAncestorDirectory, "package.json"),
        written: "{}",
      });
      return defaultSpoolRoot(start);
    });

    it("puts the spool beside the manifest that ancestor carries", ({
      spoolRootOfTheNestedStart,
    }) => {
      expect(spoolRootOfTheNestedStart).toBe(joinPath(markedAncestorDirectory, ".spool"));
    });
  });

  describe("a start directory with no package manifest above it", () => {
    const unmarkedStartDirectory = makeTempDirectory("log-destination-unmarked-start-");

    const it = test.extend("spoolRootOfTheUnmarkedStart", ({}, { onCleanup }) => {
      makeDirectory(unmarkedStartDirectory);
      onCleanup(() => {
        removePath(unmarkedStartDirectory);
      });
      return defaultSpoolRoot(unmarkedStartDirectory);
    });

    it("puts the spool beside the start directory itself", ({ spoolRootOfTheUnmarkedStart }) => {
      expect(spoolRootOfTheUnmarkedStart).toBe(joinPath(unmarkedStartDirectory, ".spool"));
    });
  });

  describe("a search handed no start directory", () => {
    const it = test.extend("spoolRootOfTheImplicitStart", () => defaultSpoolRoot());

    it("begins the search at the working directory", ({ spoolRootOfTheImplicitStart }) => {
      expect(spoolRootOfTheImplicitStart).toBe(joinPath(process.cwd(), ".spool"));
    });
  });
});

describe("timestampOf", () => {
  describe("an instant carrying milliseconds", () => {
    const it = test.extend("timestampOfAnInstant", () =>
      timestampOf(dateFrom("2026-08-12T03:04:05.678Z")));

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
