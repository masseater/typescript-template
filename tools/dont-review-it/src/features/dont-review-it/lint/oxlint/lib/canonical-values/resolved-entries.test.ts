import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { fingerprintValues } from "./fingerprint.ts";

layer(NodeServices.layer)("an annotated array", (it) => {
  const fixture = Effect.gen(function* catalogEntryOfAnAnnotatedArray() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.at(0);
  });

  it.effect("becomes one binding-aware catalog entry", () =>
    Effect.gen(function* program() {
      const catalogEntryOfAnAnnotatedArray = yield* fixture;
      expect(catalogEntryOfAnAnnotatedArray).toStrictEqual({
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 51,
        conceptId: "order.status",
        declarationEnd: 100,
        declarationPath: "src/order-status.ts",
        declarationStart: 38,
        fingerprint: fingerprintValues(["draft", "published"]),
        importRoutes: [],
        packageName: null,
        values: ["draft", "published"],
      });
    }),
  );
});

layer(NodeServices.layer)("a tuple of negative numbers, booleans, and null", (it) => {
  const fixture = Effect.gen(function* canonicalValuesOfASignedAndBooleanTuple() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "retry.ts"),
      "/** @canonical-values retry.outcome */\nexport const OUTCOMES = [-1, 1, true, null] as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it.effect("comes from the resolved tuple type", () =>
    Effect.gen(function* program() {
      const canonicalValuesOfASignedAndBooleanTuple = yield* fixture;
      expect(canonicalValuesOfASignedAndBooleanTuple).toStrictEqual([true, null, -1, 1]);
    }),
  );
});

layer(NodeServices.layer)("a tuple of positive unary numbers", (it) => {
  const fixture = Effect.gen(function* canonicalValuesOfAPositiveUnaryTuple() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "retry.ts"),
      "/** @canonical-values retry.outcome */\nexport const OUTCOMES = [+1, +2] as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it.effect("loses the sign the tuple wrote", () =>
    Effect.gen(function* program() {
      const canonicalValuesOfAPositiveUnaryTuple = yield* fixture;
      expect(canonicalValuesOfAPositiveUnaryTuple).toStrictEqual([1, 2]);
    }),
  );
});

layer(NodeServices.layer)("a tuple spreading a local binding and an imported binding", (it) => {
  const fixture = Effect.gen(function* canonicalValuesOfASpreadingTuple() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "base.ts"),
      '/** @canonical-values base.status */\nexport const BASE = ["draft"] as const;\n',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "order-status.ts"),
      'import { BASE } from "./base.ts";\n/** @canonical-values order.status */\nexport const ORDER_STATUSES = [...BASE, "published"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot })
      .catalog.entries.filter((declarationEntry) => declarationEntry.conceptId === "order.status")
      .flatMap((declarationEntry) => declarationEntry.values);
  });

  it.effect("forms one finite domain", () =>
    Effect.gen(function* program() {
      const canonicalValuesOfASpreadingTuple = yield* fixture;
      expect(canonicalValuesOfASpreadingTuple).toStrictEqual(["draft", "published"]);
    }),
  );
});

layer(NodeServices.layer)("a tuple holding a conditional item", (it) => {
  const fixture = Effect.gen(function* canonicalValuesOfAConditionalItemTuple() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUSES = [true ? "draft" : "published", "archived"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it.effect("remains a finite domain", () =>
    Effect.gen(function* program() {
      const canonicalValuesOfAConditionalItemTuple = yield* fixture;
      expect(canonicalValuesOfAConditionalItemTuple).toStrictEqual([
        "archived",
        "draft",
        "published",
      ]);
    }),
  );
});

layer(NodeServices.layer)("owners under separate TypeScript paths configurations", (it) => {
  const fixture = Effect.gen(function* conceptIdsAndValuesOfSeparatelyConfiguredOwners() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages", "orders", "src"), {
      recursive: true,
    });
    yield* filesystem.makeDirectory(
      pathService.join(repositoryRoot, "packages", "articles", "src"),
      { recursive: true },
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "orders", "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":".","paths":{"@internal/base":["src/base.ts"]}}}',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "articles", "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":".","paths":{"@internal/base":["src/base.ts"]}}}',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "orders", "src", "base.ts"),
      '/** @canonical-values order.base */\nexport const BASE = ["draft"] as const;\n',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "articles", "src", "base.ts"),
      '/** @canonical-values article.base */\nexport const BASE = ["writing"] as const;\n',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "orders", "src", "status.ts"),
      'import { BASE } from "@internal/base";\n/** @canonical-values order.status */\nexport const STATUSES = [...BASE, "published"] as const;\n',
    );
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "packages", "articles", "src", "status.ts"),
      'import { BASE } from "@internal/base";\n/** @canonical-values article.status */\nexport const STATUSES = [...BASE, "review"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot })
      .catalog.entries.filter((declarationEntry) => declarationEntry.conceptId.endsWith(".status"))
      .map((declarationEntry) => [declarationEntry.conceptId, declarationEntry.values]);
  });

  it.effect("each read the paths nearest to them", () =>
    Effect.gen(function* program() {
      const conceptIdsAndValuesOfSeparatelyConfiguredOwners = yield* fixture;
      expect(conceptIdsAndValuesOfSeparatelyConfiguredOwners).toStrictEqual([
        ["article.status", ["review", "writing"]],
        ["order.status", ["draft", "published"]],
      ]);
    }),
  );
});

layer(NodeServices.layer)("an annotated object binding", (it) => {
  const fixture = Effect.gen(function* canonicalValuesOfAnAnnotatedObjectBinding() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUS = { draft: { label: "Draft" }, published: null } as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it.effect("declares its property names", () =>
    Effect.gen(function* program() {
      const canonicalValuesOfAnAnnotatedObjectBinding = yield* fixture;
      expect(canonicalValuesOfAnAnnotatedObjectBinding).toStrictEqual(["draft", "published"]);
    }),
  );
});

layer(NodeServices.layer)("an empty tuple", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfAnEmptyTuple = yield* Effect.gen(function* conceptIdsOfAnEmptyTuple() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = [] as const;\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    });
    const vocabularyProblemsOfAnEmptyTuple = yield* Effect.gen(
      function* vocabularyProblemsOfAnEmptyTuple() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES = [] as const;\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfAnEmptyTuple, vocabularyProblemsOfAnEmptyTuple };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfAnEmptyTuple } = yield* fixtures;
      expect(conceptIdsOfAnEmptyTuple).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfAnEmptyTuple } = yield* fixtures;
      expect(vocabularyProblemsOfAnEmptyTuple).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("a widened array", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfAWidenedArray = yield* Effect.gen(function* conceptIdsOfAWidenedArray() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = ["draft", "published"];\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    });
    const vocabularyProblemsOfAWidenedArray = yield* Effect.gen(
      function* vocabularyProblemsOfAWidenedArray() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = ["draft", "published"];\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfAWidenedArray, vocabularyProblemsOfAWidenedArray };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfAWidenedArray } = yield* fixtures;
      expect(conceptIdsOfAWidenedArray).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfAWidenedArray } = yield* fixtures;
      expect(vocabularyProblemsOfAWidenedArray).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("a scalar", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfAScalar = yield* Effect.gen(function* conceptIdsOfAScalar() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = "draft" as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    });
    const vocabularyProblemsOfAScalar = yield* Effect.gen(function* vocabularyProblemsOfAScalar() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = "draft" as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });
    return { conceptIdsOfAScalar, vocabularyProblemsOfAScalar };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfAScalar } = yield* fixtures;
      expect(conceptIdsOfAScalar).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfAScalar } = yield* fixtures;
      expect(vocabularyProblemsOfAScalar).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("a call as the whole initializer", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfACallInitializer = yield* Effect.gen(
      function* conceptIdsOfACallInitializer() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES = buildValues();\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfACallInitializer = yield* Effect.gen(
      function* vocabularyProblemsOfACallInitializer() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES = buildValues();\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfACallInitializer, vocabularyProblemsOfACallInitializer };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfACallInitializer } = yield* fixtures;
      expect(conceptIdsOfACallInitializer).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfACallInitializer } = yield* fixtures;
      expect(vocabularyProblemsOfACallInitializer).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("a call inside a tuple", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfACallInsideATuple = yield* Effect.gen(
      function* conceptIdsOfACallInsideATuple() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = [buildValue(), "published"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfACallInsideATuple = yield* Effect.gen(
      function* vocabularyProblemsOfACallInsideATuple() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = [buildValue(), "published"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfACallInsideATuple, vocabularyProblemsOfACallInsideATuple };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfACallInsideATuple } = yield* fixtures;
      expect(conceptIdsOfACallInsideATuple).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfACallInsideATuple } = yield* fixtures;
      expect(vocabularyProblemsOfACallInsideATuple).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("an unsupported unary expression", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfAnUnsupportedUnaryExpression = yield* Effect.gen(
      function* conceptIdsOfAnUnsupportedUnaryExpression() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = [~1, "published"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfAnUnsupportedUnaryExpression = yield* Effect.gen(
      function* vocabularyProblemsOfAnUnsupportedUnaryExpression() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = [~1, "published"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return {
      conceptIdsOfAnUnsupportedUnaryExpression,
      vocabularyProblemsOfAnUnsupportedUnaryExpression,
    };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfAnUnsupportedUnaryExpression } = yield* fixtures;
      expect(conceptIdsOfAnUnsupportedUnaryExpression).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfAnUnsupportedUnaryExpression } = yield* fixtures;
      expect(vocabularyProblemsOfAnUnsupportedUnaryExpression).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("unary numeric coercion of a boolean", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfACoercedBoolean = yield* Effect.gen(function* conceptIdsOfACoercedBoolean() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [+true, "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    });
    const vocabularyProblemsOfACoercedBoolean = yield* Effect.gen(
      function* vocabularyProblemsOfACoercedBoolean() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = [+true, "published"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfACoercedBoolean, vocabularyProblemsOfACoercedBoolean };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfACoercedBoolean } = yield* fixtures;
      expect(conceptIdsOfACoercedBoolean).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfACoercedBoolean } = yield* fixtures;
      expect(vocabularyProblemsOfACoercedBoolean).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("direct duplicate values", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfDirectDuplicateValues = yield* Effect.gen(
      function* conceptIdsOfDirectDuplicateValues() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = ["draft", "draft"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfDirectDuplicateValues = yield* Effect.gen(
      function* vocabularyProblemsOfDirectDuplicateValues() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          '/** @canonical-values order.status */\nexport const VALUES = ["draft", "draft"] as const;\n',
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfDirectDuplicateValues, vocabularyProblemsOfDirectDuplicateValues };
  });

  it.effect("own no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfDirectDuplicateValues } = yield* fixtures;
      expect(conceptIdsOfDirectDuplicateValues).toStrictEqual([]);
    }),
  );

  it.effect("are reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfDirectDuplicateValues } = yield* fixtures;
      expect(vocabularyProblemsOfDirectDuplicateValues).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("direct duplicate false values", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfDirectDuplicateFalseValues = yield* Effect.gen(
      function* conceptIdsOfDirectDuplicateFalseValues() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES = [false, false] as const;\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfDirectDuplicateFalseValues = yield* Effect.gen(
      function* vocabularyProblemsOfDirectDuplicateFalseValues() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES = [false, false] as const;\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return {
      conceptIdsOfDirectDuplicateFalseValues,
      vocabularyProblemsOfDirectDuplicateFalseValues,
    };
  });

  it.effect("own no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfDirectDuplicateFalseValues } = yield* fixtures;
      expect(conceptIdsOfDirectDuplicateFalseValues).toStrictEqual([]);
    }),
  );

  it.effect("are reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfDirectDuplicateFalseValues } = yield* fixtures;
      expect(vocabularyProblemsOfDirectDuplicateFalseValues).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("an optional object key", (it) => {
  const fixtures = Effect.gen(function* fixtures() {
    const conceptIdsOfAnOptionalObjectKey = yield* Effect.gen(
      function* conceptIdsOfAnOptionalObjectKey() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES: { draft?: null; published: null } = { published: null };\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
          (declarationEntry) => declarationEntry.conceptId,
        );
      },
    );
    const vocabularyProblemsOfAnOptionalObjectKey = yield* Effect.gen(
      function* vocabularyProblemsOfAnOptionalObjectKey() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src", "values.ts"),
          "/** @canonical-values order.status */\nexport const VALUES: { draft?: null; published: null } = { published: null };\n",
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      },
    );
    return { conceptIdsOfAnOptionalObjectKey, vocabularyProblemsOfAnOptionalObjectKey };
  });

  it.effect("owns no catalog entry", () =>
    Effect.gen(function* program() {
      const { conceptIdsOfAnOptionalObjectKey } = yield* fixtures;
      expect(conceptIdsOfAnOptionalObjectKey).toStrictEqual([]);
    }),
  );

  it.effect("is reported as a vocabulary without values", () =>
    Effect.gen(function* program() {
      const { vocabularyProblemsOfAnOptionalObjectKey } = yield* fixtures;
      expect(vocabularyProblemsOfAnOptionalObjectKey).toStrictEqual([
        {
          conceptId: "order.status",
          filePath: "src/values.ts",
          kind: "vocabulary-without-values",
          line: 1,
        },
      ]);
    }),
  );
});

layer(NodeServices.layer)("an unresolved computed object key", (it) => {
  const fixture = Effect.gen(function* conceptIdsOfAnUnresolvedComputedObjectKey() {
    const filesystem = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "canonical-values-",
    });

    yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      pathService.join(repositoryRoot, "src", "values.ts"),
      "declare function runtimeKey(): string;\nconst KEY = runtimeKey();\n/** @canonical-values order.status */\nexport const VALUES = { [KEY]: 0, published: 1 } as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
      (declarationEntry) => declarationEntry.conceptId,
    );
  });

  it.effect("creates no catalog entry", () =>
    Effect.gen(function* program() {
      const conceptIdsOfAnUnresolvedComputedObjectKey = yield* fixture;
      expect(conceptIdsOfAnUnresolvedComputedObjectKey).toStrictEqual([]);
    }),
  );
});
