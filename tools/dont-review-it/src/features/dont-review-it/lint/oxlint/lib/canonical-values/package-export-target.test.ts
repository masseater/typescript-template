import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  packageExportPatternCaptures,
  packageExportSourceFile,
  packageExportTargetPatterns,
  singleWildcardPattern,
  substitutePackageExportPattern,
  validPackageExportTargetPattern,
  winningPackageExportSubpath,
} from "./package-export-target.ts";

const PATH_ONLY_PACKAGE_DIRECTORY = "/packages/example";

layer(NodeServices.layer)("packageExportSourceFile", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const filesystem = yield* FileSystem.FileSystem;
    const temporaryPackageDirectory = yield* filesystem.makeTempDirectoryScoped({
      prefix: "package-export-target-spec-",
    });
    const sourceFileBehindAJsTarget = yield* Effect.gen(function* sourceFileBehindAJsTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        paths.join(temporaryPackageDirectory, "src/value.ts"),
        "export {};\n",
      );
      return packageExportSourceFile(temporaryPackageDirectory, "./src/value.js");
    });
    const sourceFileBehindAJsxTarget = yield* Effect.gen(function* sourceFileBehindAJsxTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        paths.join(temporaryPackageDirectory, "src/view.tsx"),
        "export {};\n",
      );
      return packageExportSourceFile(temporaryPackageDirectory, "./src/view.jsx");
    });
    const sourceFileBehindAnMjsTarget = yield* Effect.gen(function* sourceFileBehindAnMjsTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        paths.join(temporaryPackageDirectory, "src/module.mts"),
        "export {};\n",
      );
      return packageExportSourceFile(temporaryPackageDirectory, "./src/module.mjs");
    });
    const sourceFileBehindACjsTarget = yield* Effect.gen(function* sourceFileBehindACjsTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        paths.join(temporaryPackageDirectory, "src/common.cts"),
        "export {};\n",
      );
      return packageExportSourceFile(temporaryPackageDirectory, "./src/common.cjs");
    });
    const sourceFileBehindAJsonTarget = yield* Effect.gen(function* sourceFileBehindAJsonTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        paths.join(temporaryPackageDirectory, "src/exact.json"),
        "{}\n",
      );
      return packageExportSourceFile(temporaryPackageDirectory, "./src/exact.json");
    });
    const sourceFileBehindADirectoryTarget = yield* Effect.gen(
      function* sourceFileBehindADirectoryTarget() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src/directory"), {
          recursive: true,
        });

        yield* filesystem.writeFileString(
          paths.join(temporaryPackageDirectory, "src/directory/index.ts"),
          "export {};\n",
        );
        return packageExportSourceFile(temporaryPackageDirectory, "./src/directory");
      },
    );
    const sourceFileBehindAnAbsentTarget = yield* Effect.gen(
      function* sourceFileBehindAnAbsentTarget() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.makeDirectory(paths.join(temporaryPackageDirectory, "src"), {
          recursive: true,
        });

        return packageExportSourceFile(temporaryPackageDirectory, "./src/missing");
      },
    );
    return {
      temporaryPackageDirectory,
      sourceFileBehindAJsTarget,
      sourceFileBehindAJsxTarget,
      sourceFileBehindAnMjsTarget,
      sourceFileBehindACjsTarget,
      sourceFileBehindAJsonTarget,
      sourceFileBehindADirectoryTarget,
      sourceFileBehindAnAbsentTarget,
    };
  });

  it.effect("reads a .js target as the TypeScript source beside it", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindAJsTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindAJsTarget).toBe(paths.join(temporaryPackageDirectory, "src/value.ts"));
    }),
  );

  it.effect("reads a .jsx target as the TSX source beside it", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindAJsxTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindAJsxTarget).toBe(
        paths.join(temporaryPackageDirectory, "src/view.tsx"),
      );
    }),
  );

  it.effect("reads a .mjs target as the .mts source beside it", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindAnMjsTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindAnMjsTarget).toBe(
        paths.join(temporaryPackageDirectory, "src/module.mts"),
      );
    }),
  );

  it.effect("reads a .cjs target as the .cts source beside it", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindACjsTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindACjsTarget).toBe(
        paths.join(temporaryPackageDirectory, "src/common.cts"),
      );
    }),
  );

  it.effect("keeps a target that already names a file on disk", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindAJsonTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindAJsonTarget).toBe(
        paths.join(temporaryPackageDirectory, "src/exact.json"),
      );
    }),
  );

  it.effect("reads a directory target as its index", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { sourceFileBehindADirectoryTarget, temporaryPackageDirectory } = yield* fixtures;
      expect(sourceFileBehindADirectoryTarget).toBe(
        paths.join(temporaryPackageDirectory, "src/directory/index.ts"),
      );
    }),
  );

  it.effect("answers null when no candidate exists", () =>
    Effect.gen(function* program() {
      const { sourceFileBehindAnAbsentTarget } = yield* fixtures;
      expect(sourceFileBehindAnAbsentTarget).toBe(null);
    }),
  );
});

describe("singleWildcardPattern", () => {
  const it = test
    .extend("wildcardSplitOfAPatternHoldingOneWildcard", () => singleWildcardPattern("./src/*.ts"))
    .extend("wildcardSplitOfAPatternWithoutAWildcard", () =>
      singleWildcardPattern("./src/value.ts"),
    )
    .extend("wildcardSplitOfAPatternHoldingTwoWildcards", () =>
      singleWildcardPattern("./src/**.ts"),
    );

  it("splits one wildcard into the text around it", ({
    wildcardSplitOfAPatternHoldingOneWildcard,
  }) => {
    expect(wildcardSplitOfAPatternHoldingOneWildcard).toStrictEqual({
      prefix: "./src/",
      suffix: ".ts",
    });
  });

  it("refuses a pattern carrying no wildcard", ({ wildcardSplitOfAPatternWithoutAWildcard }) => {
    expect(wildcardSplitOfAPatternWithoutAWildcard).toBe(null);
  });

  it("refuses a pattern carrying a second wildcard", ({
    wildcardSplitOfAPatternHoldingTwoWildcards,
  }) => {
    expect(wildcardSplitOfAPatternHoldingTwoWildcards).toBe(null);
  });
});

describe("winningPackageExportSubpath", () => {
  const it = test
    .extend("winningSubpathForAnExactSpelling", () =>
      winningPackageExportSubpath(["./*", "./private/*", "./private/*.ts", "./exact"], "./exact"))
    .extend("winningSubpathForALongerPatternUnderAPrefix", () =>
      winningPackageExportSubpath(
        ["./*", "./private/*", "./private/*.ts", "./exact"],
        "./private/status.ts",
      ),
    )
    .extend("winningSubpathForALongerPrefix", () =>
      winningPackageExportSubpath(["./private/*", "./*"], "./private/status"),
    )
    .extend("winningSubpathForALongerSuffix", () =>
      winningPackageExportSubpath(["./*", "./*.ts"], "./status.ts"),
    )
    .extend("winningSubpathForANestedCandidate", () =>
      winningPackageExportSubpath(["./*"], "./nested/status"),
    )
    .extend("winningSubpathForAnUnmatchedSuffix", () =>
      winningPackageExportSubpath(["./*.ts"], "./status.js"),
    )
    .extend("winningSubpathBesideALiteralQuestionMark", () =>
      winningPackageExportSubpath(["./?", "./*"], "./status"),
    )
    .extend("winningSubpathForATrailingSuffix", () =>
      winningPackageExportSubpath(["./*suffix", "./*"], "./statussuffix"),
    )
    .extend("winningSubpathAmongRepeatedSpellings", () =>
      winningPackageExportSubpath(["./*", "./*"], "./status"),
    );

  it("takes an exact spelling ahead of every pattern", ({ winningSubpathForAnExactSpelling }) => {
    expect(winningSubpathForAnExactSpelling).toBe("./exact");
  });

  it("takes the longer pattern under a shared prefix", ({
    winningSubpathForALongerPatternUnderAPrefix,
  }) => {
    expect(winningSubpathForALongerPatternUnderAPrefix).toBe("./private/*.ts");
  });

  it("takes the pattern whose base is longer", ({ winningSubpathForALongerPrefix }) => {
    expect(winningSubpathForALongerPrefix).toBe("./private/*");
  });

  it("takes the longer spelling when the bases tie", ({ winningSubpathForALongerSuffix }) => {
    expect(winningSubpathForALongerSuffix).toBe("./*.ts");
  });

  it("lets one wildcard span a nested candidate", ({ winningSubpathForANestedCandidate }) => {
    expect(winningSubpathForANestedCandidate).toBe("./*");
  });

  it("answers null when no pattern reaches the candidate", ({
    winningSubpathForAnUnmatchedSuffix,
  }) => {
    expect(winningSubpathForAnUnmatchedSuffix).toBe(null);
  });

  it("treats a question mark as an ordinary character", ({
    winningSubpathBesideALiteralQuestionMark,
  }) => {
    expect(winningSubpathBesideALiteralQuestionMark).toBe("./*");
  });

  it("matches a suffix written after the wildcard", ({ winningSubpathForATrailingSuffix }) => {
    expect(winningSubpathForATrailingSuffix).toBe("./*suffix");
  });

  it("keeps the first of two identical spellings", ({ winningSubpathAmongRepeatedSpellings }) => {
    expect(winningSubpathAmongRepeatedSpellings).toBe("./*");
  });
});

describe("packageExportTargetPatterns", () => {
  const it = test
    .extend("targetPatternsWithTypesAdmitted", () =>
      packageExportTargetPatterns({
        depth: 0,
        includeTypes: true,
        value: {
          types: "./types/index.d.ts",
          import: ["./src/index.js", null],
          default: "./src/fallback.js",
        },
      }))
    .extend("targetPatternsWithTypesTurnedAway", () =>
      packageExportTargetPatterns({
        depth: 0,
        includeTypes: false,
        value: {
          types: "./types/index.d.ts",
          import: ["./src/index.js", null],
          default: "./src/fallback.js",
        },
      }),
    )
    .extend("targetPatternsOfANullTarget", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: null }),
    )
    .extend("targetPatternsOfANumericTarget", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: 1 }),
    )
    .extend("targetPatternsOfAConditionTreePastTheDepthLimit", () =>
      packageExportTargetPatterns({ depth: 9, includeTypes: true, value: {} }),
    )
    .extend("targetPatternsOfAnAlternativeListHoldingANumber", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: [1] }),
    )
    .extend("targetPatternsOfAnAlternativeListPastTheDepthLimit", () =>
      packageExportTargetPatterns({ depth: 9, includeTypes: true, value: ["./src/index.js"] }),
    )
    .extend("targetPatternsOfAConditionHoldingANumber", () =>
      packageExportTargetPatterns({ depth: 8, includeTypes: true, value: { import: 1 } }),
    );

  it("flattens every condition once types are admitted", ({ targetPatternsWithTypesAdmitted }) => {
    expect(targetPatternsWithTypesAdmitted).toStrictEqual([
      "./types/index.d.ts",
      "./src/index.js",
      "./src/fallback.js",
    ]);
  });

  it("drops the types condition once types are turned away", ({
    targetPatternsWithTypesTurnedAway,
  }) => {
    expect(targetPatternsWithTypesTurnedAway).toStrictEqual([
      "./src/index.js",
      "./src/fallback.js",
    ]);
  });

  it("reads a null target as contributing nothing", ({ targetPatternsOfANullTarget }) => {
    expect(targetPatternsOfANullTarget).toStrictEqual([]);
  });

  it("refuses a target that is neither string nor object", ({ targetPatternsOfANumericTarget }) => {
    expect(targetPatternsOfANumericTarget).toBe(null);
  });

  it("refuses a condition tree nested past the depth limit", ({
    targetPatternsOfAConditionTreePastTheDepthLimit,
  }) => {
    expect(targetPatternsOfAConditionTreePastTheDepthLimit).toBe(null);
  });

  it("refuses an alternative that is neither string nor object", ({
    targetPatternsOfAnAlternativeListHoldingANumber,
  }) => {
    expect(targetPatternsOfAnAlternativeListHoldingANumber).toBe(null);
  });

  it("refuses an alternative list nested past the depth limit", ({
    targetPatternsOfAnAlternativeListPastTheDepthLimit,
  }) => {
    expect(targetPatternsOfAnAlternativeListPastTheDepthLimit).toBe(null);
  });

  it("refuses a condition whose branch is neither string nor object", ({
    targetPatternsOfAConditionHoldingANumber,
  }) => {
    expect(targetPatternsOfAConditionHoldingANumber).toBe(null);
  });
});

describe("validPackageExportTargetPattern", () => {
  const it = test
    .extend("verdictOnAWildcardTargetInsideThePackage", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "./src/*.ts"))
    .extend("verdictOnATargetWithoutAWildcard", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "./src/value.ts"),
    )
    .extend("verdictOnAWildcardTargetOutsideThePackage", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "../shared/*.ts"),
    );

  it("admits a wildcard target under the package", ({
    verdictOnAWildcardTargetInsideThePackage,
  }) => {
    expect(verdictOnAWildcardTargetInsideThePackage).toBe(true);
  });

  it("turns away a target carrying no wildcard", ({ verdictOnATargetWithoutAWildcard }) => {
    expect(verdictOnATargetWithoutAWildcard).toBe(false);
  });

  it("turns away a target escaping the package", ({
    verdictOnAWildcardTargetOutsideThePackage,
  }) => {
    expect(verdictOnAWildcardTargetOutsideThePackage).toBe(false);
  });
});

describe("packageExportPatternCaptures", () => {
  const it = test
    .extend("capturesAcrossTwoTargetSpellings", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/owner.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/owner.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/private/value.ts`,
        ],
        targets: ["./src/public/*.js", "./src/public/*.ts"],
      }))
    .extend("capturesFromAFileLeavingTheWildcardEmpty", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/.ts`],
        targets: ["./src/public/*.ts"],
      }),
    )
    .extend("capturesFromATargetWithoutAWildcard", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status.ts`],
        targets: ["./src/public/value.ts"],
      }),
    )
    .extend("capturesFromAFileSpellingAWildcard", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status*.ts`],
        targets: ["./src/public/*.ts"],
      }),
    );

  it("collects each capture once and sorts them", ({ capturesAcrossTwoTargetSpellings }) => {
    expect(capturesAcrossTwoTargetSpellings).toStrictEqual(["owner", "status"]);
  });

  it("drops a file that leaves the wildcard empty", ({
    capturesFromAFileLeavingTheWildcardEmpty,
  }) => {
    expect(capturesFromAFileLeavingTheWildcardEmpty).toStrictEqual([]);
  });

  it("drops a target that carries no wildcard", ({ capturesFromATargetWithoutAWildcard }) => {
    expect(capturesFromATargetWithoutAWildcard).toStrictEqual([]);
  });

  it("drops a file whose capture spells a wildcard", ({ capturesFromAFileSpellingAWildcard }) => {
    expect(capturesFromAFileSpellingAWildcard).toStrictEqual([]);
  });
});

describe("substitutePackageExportPattern", () => {
  const it = test.extend("substitutionAcrossAConditionTree", () =>
    substitutePackageExportPattern({ import: ["./src/*.js", null], default: 1 }, "status"));

  it("rewrites every string and leaves the rest alone", ({ substitutionAcrossAConditionTree }) => {
    expect(substitutionAcrossAConditionTree).toStrictEqual({
      import: ["./src/status.js", null],
      default: 1,
    });
  });
});
