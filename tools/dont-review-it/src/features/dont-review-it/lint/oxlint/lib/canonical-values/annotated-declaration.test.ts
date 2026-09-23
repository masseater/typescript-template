import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import { analyzeCanonicalValuesRepository } from "./builder.ts";

layer(NodeServices.layer)("registeredDeclarationRanges", (it) => {
  describe("a source holding the declaration exactly where the catalog recorded it", () => {
    const fixture = Effect.gen(function* conceptIdsExemptedInTheRecordedSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      const sourceText = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`;
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src/status.ts"), sourceText);
      const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return registeredDeclarationRanges({
        catalog,
        filename: paths.join(repositoryRoot, "src/status.ts"),
        repositoryRoot,
        sourceText,
      }).map((exemptedRange) => exemptedRange.conceptId);
    });

    it.effect("exempts that one declaration", () =>
      Effect.gen(function* program() {
        const conceptIdsExemptedInTheRecordedSource = yield* fixture;
        expect(conceptIdsExemptedInTheRecordedSource).toStrictEqual(["order.status"]);
      }),
    );
  });

  describe("a source whose declaration has moved since the catalog recorded it", () => {
    const fixture = Effect.gen(function* rangesExemptedInTheMovedSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      const sourceText = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`;
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src/status.ts"), sourceText);
      const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return registeredDeclarationRanges({
        catalog,
        filename: paths.join(repositoryRoot, "src/status.ts"),
        repositoryRoot,
        sourceText: `\n${sourceText}`,
      });
    });

    it.effect("exempts nothing", () =>
      Effect.gen(function* program() {
        const rangesExemptedInTheMovedSource = yield* fixture;
        expect(rangesExemptedInTheMovedSource).toStrictEqual([]);
      }),
    );
  });
});
