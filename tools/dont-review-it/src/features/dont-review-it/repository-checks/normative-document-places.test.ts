import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { normativeDocumentPlacesIn, normativeDocumentsIn } from "./normative-document-places.ts";

const WITHOUT_A_DECLARATION = { fileName: "AGENTS.md", directories: [] };

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const repositoryWithManifest = (manifestText: string | null) =>
  Effect.gen(function* repositoryWithManifest() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "normative-places-" });
    if (manifestText !== null) {
      yield* filesystem.writeFileString(paths.join(root, "package.json"), manifestText);
    }
    return root;
  });

layer(NodeServices.layer)("normativeDocumentPlacesIn", (it) => {
  describe("a repository without a manifest", () => {
    it.effect("names the document every repository is read through, and no place", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(yield* repositoryWithManifest(null));
        expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
      }),
    );
  });

  describe("a manifest that is not an object", () => {
    it.effect("reads it as no declaration", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(yield* repositoryWithManifest("[]"));
        expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
      }),
    );
  });

  describe("a manifest that is not JSON", () => {
    it.effect("fails as a manifest that could not be decoded", () =>
      Effect.gen(function* program() {
        const failure = yield* Effect.flip(
          normativeDocumentPlacesIn(yield* repositoryWithManifest("{")),
        );
        expect(failure._tag).toBe("SchemaError");
      }),
    );
  });

  describe("a manifest declaring nothing about its norms", () => {
    it.effect("reads it as no declaration", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(
          yield* repositoryWithManifest(yield* encodeJson({ name: "probe" })),
        );
        expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
      }),
    );
  });

  describe("a declaration naming both the document and the places", () => {
    it.effect("takes both from the declaration", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(
          yield* repositoryWithManifest(
            yield* encodeJson({
              normativeDocuments: { fileName: "CONVENTIONS.md", directories: ["docs/norms"] },
            }),
          ),
        );
        expect(places).toStrictEqual({ fileName: "CONVENTIONS.md", directories: ["docs/norms"] });
      }),
    );
  });

  describe("a declaration whose fields are of the wrong shape", () => {
    it.effect("falls back to what a repository without a declaration gets", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(
          yield* repositoryWithManifest(
            yield* encodeJson({ normativeDocuments: { fileName: 7, directories: "docs/norms" } }),
          ),
        );
        expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
      }),
    );
  });

  describe("a declaration listing something that is not a path", () => {
    it.effect("keeps the paths and drops the rest", () =>
      Effect.gen(function* program() {
        const places = yield* normativeDocumentPlacesIn(
          yield* repositoryWithManifest(
            yield* encodeJson({ normativeDocuments: { directories: ["docs/norms", 7] } }),
          ),
        );
        expect(places).toStrictEqual({ fileName: "AGENTS.md", directories: ["docs/norms"] });
      }),
    );
  });
});

layer(NodeServices.layer)("normativeDocumentsIn", (it) => {
  describe("a place the repository holds at its root and under a workspace", () => {
    const fixture = Effect.gen(function* documents() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* repositoryWithManifest(null);
      yield* filesystem.makeDirectory(paths.join(root, "docs/norms/rationales"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/docs/norms"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, "docs/norms/tests.md"), "# tests\n");
      yield* filesystem.writeFileString(paths.join(root, "docs/norms/notes.txt"), "plain\n");
      yield* filesystem.writeFileString(
        paths.join(root, "docs/norms/rationales/why.md"),
        "# why\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/docs/norms/local.md"),
        "# local\n",
      );
      yield* filesystem.symlink(
        paths.join(root, "docs/norms/tests.md"),
        paths.join(root, "docs/norms/linked.md"),
      );
      return yield* normativeDocumentsIn({
        repositoryRoot: root,
        places: { fileName: "AGENTS.md", directories: ["docs/norms"] },
        workspaceDirectories: ["packages/example"],
      });
    });

    it.effect("takes the documents directly in each place, following no link", () =>
      Effect.gen(function* program() {
        const documents = yield* fixture;
        expect(documents).toStrictEqual([
          "docs/norms/tests.md",
          "packages/example/docs/norms/local.md",
        ]);
      }),
    );
  });

  describe("a place the repository does not hold", () => {
    it.effect("finds nothing", () =>
      Effect.gen(function* program() {
        const documents = yield* normativeDocumentsIn({
          repositoryRoot: yield* repositoryWithManifest(null),
          places: { fileName: "AGENTS.md", directories: ["docs/norms"] },
          workspaceDirectories: [],
        });
        expect(documents).toStrictEqual([]);
      }),
    );
  });
});
