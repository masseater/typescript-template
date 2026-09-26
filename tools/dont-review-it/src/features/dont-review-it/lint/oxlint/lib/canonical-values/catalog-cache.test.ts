import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Crypto, Effect, Encoding, FileSystem, Path, Schema } from "effect";
import { attempt, omit } from "es-toolkit";
import { describe, expect } from "vite-plus/test";

import { readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { fingerprintValues } from "./fingerprint.ts";

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

const ORDER_STATUS_CATALOG_ENTRY = {
  annotationStart: 0,
  binding: "VALUES",
  bindingStart: 2,
  conceptId: "order.status",
  declarationEnd: 3,
  declarationPath: "src/status.ts",
  declarationStart: 1,
  fingerprint: fingerprintValues(["draft"]),
  importRoutes: [
    {
      exportName: "VALUES",
      resolvedSourcePaths: ["src/index.ts"],
      specifier: "@fixture/vocabulary",
    },
  ],
  packageName: null,
  values: ["draft"],
};

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const integrityOf = (cacheDocument: object) =>
  Effect.gen(function* integrityOf() {
    const crypto = yield* Crypto.Crypto;
    const digest = yield* crypto.digest(
      "SHA-256",
      new TextEncoder().encode(yield* encodeJson(cacheDocument)),
    );
    return Encoding.encodeHex(digest);
  });

const sealedCacheText = (cacheDocument: object) =>
  integrityOf(cacheDocument).pipe(
    Effect.flatMap((integrity) => encodeJson({ ...cacheDocument, integrity })),
  );

layer(NodeServices.layer)("readCachedEntries", (it) => {
  describe("a current cache sealed for its own repository fingerprint", () => {
    const fixture = Effect.gen(function* catalogReadBackForItsOwnFingerprint() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      const cacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      yield* filesystem.writeFileString(cachePath, yield* sealedCacheText(cacheDocument));
      return readCachedEntries(root, "repository-fingerprint");
    });

    it.effect("is read back", () =>
      Effect.gen(function* program() {
        const catalogReadBackForItsOwnFingerprint = yield* fixture;
        expect(catalogReadBackForItsOwnFingerprint).toStrictEqual([ORDER_STATUS_CATALOG_ENTRY]);
      }),
    );
  });

  describe("a current cache read under a repository fingerprint that is not its own", () => {
    const fixture = Effect.gen(function* catalogReadBackForAForeignFingerprint() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      const cacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      yield* filesystem.writeFileString(cachePath, yield* sealedCacheText(cacheDocument));
      return readCachedEntries(root, "foreign-fingerprint");
    });

    it.effect("is not read back under another fingerprint", () =>
      Effect.gen(function* program() {
        const catalogReadBackForAForeignFingerprint = yield* fixture;
        expect(catalogReadBackForAForeignFingerprint).toBe(null);
      }),
    );
  });

  describe("a cache the reader cannot parse", () => {
    const fixture = Effect.gen(function* catalogReadBackFromAnUnreadableCache() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      yield* filesystem.writeFileString(cachePath, "{ this is not json");
      return readCachedEntries(root, "repository-fingerprint");
    });

    it.effect("is treated as a cache miss", () =>
      Effect.gen(function* program() {
        const catalogReadBackFromAnUnreadableCache = yield* fixture;
        expect(catalogReadBackFromAnUnreadableCache).toBe(null);
      }),
    );
  });

  describe("cache envelopes that are not the current sealed shape", () => {
    const fixture = Effect.gen(function* catalogsReadBackFromRejectedEnvelopes() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      const currentCacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      const sealedCacheDocument = {
        ...currentCacheDocument,
        integrity: yield* integrityOf(currentCacheDocument),
      };
      return yield* Effect.forEach(
        [
          null,
          "cache",
          {},
          { ...sealedCacheDocument, version: 4 },
          { ...sealedCacheDocument, fingerprint: 1 },
          { ...sealedCacheDocument, integrity: 1 },
          { ...sealedCacheDocument, entries: "entries" },
          { ...sealedCacheDocument, integrity: "forged" },
        ],
        (cacheDocument) =>
          Effect.gen(function* readBack() {
            yield* filesystem.writeFileString(cachePath, yield* encodeJson(cacheDocument));
            return readCachedEntries(root, "repository-fingerprint");
          }),
      );
    });

    it.effect("are each rejected", () =>
      Effect.gen(function* program() {
        const catalogsReadBackFromRejectedEnvelopes = yield* fixture;
        expect(catalogsReadBackFromRejectedEnvelopes).toStrictEqual([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ]);
      }),
    );
  });

  describe("entries whose identity or declaration offsets are broken", () => {
    const fixture = Effect.gen(function* catalogsReadBackFromBrokenIdentities() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      return yield* Effect.forEach(
        [
          null,
          "an entry",
          {},
          { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: 0.5 },
          { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 0.5 },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationEnd: 0.5 },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationStart: 0.5 },
          { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: -1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationStart: -1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 0 },
          { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 3 },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationEnd: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, binding: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, binding: "" },
          { ...ORDER_STATUS_CATALOG_ENTRY, conceptId: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, conceptId: "Order Status" },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationPath: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, declarationPath: "" },
          { ...ORDER_STATUS_CATALOG_ENTRY, fingerprint: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, fingerprint: "not-a-fingerprint" },
          { ...ORDER_STATUS_CATALOG_ENTRY, packageName: 1 },
          { ...ORDER_STATUS_CATALOG_ENTRY, packageName: "" },
          omit(ORDER_STATUS_CATALOG_ENTRY, ["values"]),
          omit(ORDER_STATUS_CATALOG_ENTRY, ["importRoutes"]),
          omit(ORDER_STATUS_CATALOG_ENTRY, ["declarationEnd"]),
        ],
        (candidateEntry) =>
          Effect.gen(function* readBack() {
            yield* filesystem.writeFileString(
              cachePath,
              yield* sealedCacheText({
                version: 5,
                fingerprint: "repository-fingerprint",
                entries: [candidateEntry],
              }),
            );
            return readCachedEntries(root, "repository-fingerprint");
          }),
      );
    });

    it.effect("are each rejected", () =>
      Effect.gen(function* program() {
        const catalogsReadBackFromBrokenIdentities = yield* fixture;
        expect(catalogsReadBackFromBrokenIdentities).toStrictEqual([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ]);
      }),
    );
  });

  describe("entries whose import routes are broken", () => {
    const fixture = Effect.gen(function* catalogsReadBackFromBrokenImportRoutes() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      const declaredRoute = ORDER_STATUS_CATALOG_ENTRY.importRoutes[0];
      return yield* Effect.forEach(
        [
          { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: null },
          { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [null] },
          { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{}] },
          { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{ ...declaredRoute, exportName: "" }] },
          { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{ ...declaredRoute, specifier: "" }] },
          {
            ...ORDER_STATUS_CATALOG_ENTRY,
            importRoutes: [{ exportName: "VALUES", specifier: "@fixture/vocabulary" }],
          },
          {
            ...ORDER_STATUS_CATALOG_ENTRY,
            importRoutes: [{ ...declaredRoute, resolvedSourcePaths: "src/index.ts" }],
          },
          {
            ...ORDER_STATUS_CATALOG_ENTRY,
            importRoutes: [{ ...declaredRoute, resolvedSourcePaths: [] }],
          },
          ...[
            "",
            ".",
            "src\0index.ts",
            "src\\index.ts",
            "src/../index.ts",
            "../index.ts",
            "/src/index.ts",
            "C:/src/index.ts",
          ].map((sourcePath) => ({
            ...ORDER_STATUS_CATALOG_ENTRY,
            importRoutes: [{ ...declaredRoute, resolvedSourcePaths: [sourcePath] }],
          })),
          {
            ...ORDER_STATUS_CATALOG_ENTRY,
            importRoutes: [
              { ...declaredRoute, resolvedSourcePaths: ["src/index.ts", "src/index.ts"] },
            ],
          },
        ],
        (candidateEntry) =>
          Effect.gen(function* readBack() {
            yield* filesystem.writeFileString(
              cachePath,
              yield* sealedCacheText({
                version: 5,
                fingerprint: "repository-fingerprint",
                entries: [candidateEntry],
              }),
            );
            return readCachedEntries(root, "repository-fingerprint");
          }),
      );
    });

    it.effect("are each rejected", () =>
      Effect.gen(function* program() {
        const catalogsReadBackFromBrokenImportRoutes = yield* fixture;
        expect(catalogsReadBackFromBrokenImportRoutes).toStrictEqual([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ]);
      }),
    );
  });

  describe("entries whose canonical domain is broken", () => {
    const fixture = Effect.gen(function* catalogsReadBackFromBrokenCanonicalDomains() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      return yield* Effect.forEach(
        [
          { ...ORDER_STATUS_CATALOG_ENTRY, values: null },
          { ...ORDER_STATUS_CATALOG_ENTRY, values: [{}] },
          { ...ORDER_STATUS_CATALOG_ENTRY, values: ["draft", "draft"] },
          {
            ...ORDER_STATUS_CATALOG_ENTRY,
            values: ["draft"],
            fingerprint: fingerprintValues(["other"]),
          },
        ],
        (candidateEntry) =>
          Effect.gen(function* readBack() {
            yield* filesystem.writeFileString(
              cachePath,
              yield* sealedCacheText({
                version: 5,
                fingerprint: "repository-fingerprint",
                entries: [candidateEntry],
              }),
            );
            return readCachedEntries(root, "repository-fingerprint");
          }),
      );
    });

    it.effect("are each rejected", () =>
      Effect.gen(function* program() {
        const catalogsReadBackFromBrokenCanonicalDomains = yield* fixture;
        expect(catalogsReadBackFromBrokenCanonicalDomains).toStrictEqual([null, null, null, null]);
      }),
    );
  });

  describe("an entry whose vocabulary holds no values yet", () => {
    const emptyVocabularyEntry = {
      ...ORDER_STATUS_CATALOG_ENTRY,
      fingerprint: fingerprintValues([]),
      values: [],
    };

    const fixture = Effect.gen(function* catalogReadBackWithAnEmptyVocabulary() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const cachePath = paths.join(root, ...CACHE_SEGMENTS);
      yield* filesystem.makeDirectory(paths.dirname(cachePath), { recursive: true });
      yield* filesystem.writeFileString(
        cachePath,
        yield* sealedCacheText({
          version: 5,
          fingerprint: "repository-fingerprint",
          entries: [emptyVocabularyEntry],
        }),
      );
      return readCachedEntries(root, "repository-fingerprint");
    });

    it.effect("is read back", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([emptyVocabularyEntry]);
      }),
    );
  });
});

layer(NodeServices.layer)("writeCachedEntries", (it) => {
  describe("a repository root the file system refuses to hold a cache under", () => {
    const fixture = Effect.gen(function* failure() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "catalog-cache-" });

      const occupiedRoot = paths.join(root, "not-a-directory");
      yield* filesystem.writeFileString(occupiedRoot, "occupied");
      const [failure] = attempt<unknown, Error>(() => {
        writeCachedEntries(occupiedRoot, { fingerprint: "repository-fingerprint", entries: [] });
      });
      return failure;
    });

    it.effect("is left unwritten without raising", () =>
      Effect.gen(function* program() {
        const failure = yield* fixture;
        expect(failure).toBe(null);
      }),
    );
  });
});
