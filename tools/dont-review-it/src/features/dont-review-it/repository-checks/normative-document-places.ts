import { Effect, FileSystem, type PlatformError, Schema } from "effect";
import { isPlainObject } from "es-toolkit";

import { textOrNull, unlessMissing } from "../platform/file-system.ts";
import { isNotALink } from "../platform/path-failure.ts";
import { path } from "../platform/path.ts";

export type NormativeDocumentPlaces = {
  readonly fileName: string;
  readonly directories: readonly string[];
};

const WITHOUT_A_DECLARATION: NormativeDocumentPlaces = {
  fileName: "AGENTS.md",
  directories: [],
};

const declaredIn = (
  repositoryRoot: string,
): Effect.Effect<
  Record<string, unknown> | null,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* declaredIn() {
    const MANIFEST_FILE = "package.json";
    const manifestText = yield* textOrNull(path.join(repositoryRoot, MANIFEST_FILE));

    const manifest: unknown =
      manifestText === null
        ? null
        : yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(manifestText);
    if (!isPlainObject(manifest)) return null;

    const DECLARATION_FIELD = "normativeDocuments";
    const declared: unknown = manifest[DECLARATION_FIELD];
    return isPlainObject(declared) ? declared : null;
  });

export const normativeDocumentPlacesIn = (
  repositoryRoot: string,
): Effect.Effect<
  NormativeDocumentPlaces,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem
> =>
  Effect.map(declaredIn(repositoryRoot), (declared) => {
    if (declared === null) return WITHOUT_A_DECLARATION;

    const spelledName: unknown = declared.fileName;
    const spelledDirectories: unknown = declared.directories;

    return {
      fileName: typeof spelledName === "string" ? spelledName : WITHOUT_A_DECLARATION.fileName,
      directories: Array.isArray(spelledDirectories)
        ? spelledDirectories.filter(
            (directory): directory is string => typeof directory === "string",
          )
        : WITHOUT_A_DECLARATION.directories,
    };
  });

export const DOCUMENT_SUFFIX = ".md";

const isUnlinkedFileAt = (
  entryPath: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* isUnlinkedFileAt() {
    const filesystem = yield* FileSystem.FileSystem;
    const linkText = yield* filesystem
      .readLink(entryPath)
      .pipe(Effect.catchIf(isNotALink, () => Effect.succeed(null)));
    if (linkText !== null) return false;
    const { type } = yield* filesystem.stat(entryPath);
    return type === "File";
  });

const documentsDirectlyIn = ({
  repositoryRoot,
  directory,
}: {
  readonly repositoryRoot: string;
  readonly directory: string;
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* documentsDirectlyIn() {
    const filesystem = yield* FileSystem.FileSystem;
    const directoryPath = path.join(repositoryRoot, directory);
    const listedNames = yield* unlessMissing(filesystem.readDirectory(directoryPath));
    const candidateNames = (listedNames ?? []).filter((name) => name.endsWith(DOCUMENT_SUFFIX));
    const unlinkedFiles = yield* Effect.forEach(
      candidateNames,
      (name) => isUnlinkedFileAt(path.join(directoryPath, name)),
      { concurrency: "unbounded" },
    );
    const documentNames = candidateNames.flatMap((name, index) =>
      unlinkedFiles[index] === true ? [name] : [],
    );
    return documentNames.map((name) => `${directory}/${name}`);
  });

export const normativeDocumentsIn = ({
  repositoryRoot,
  places,
  workspaceDirectories,
}: {
  readonly repositoryRoot: string;
  readonly places: NormativeDocumentPlaces;
  readonly workspaceDirectories: readonly string[];
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.map(
    Effect.forEach(
      places.directories.flatMap((directory) => [
        directory,
        ...workspaceDirectories.map((one) => path.join(one, directory)),
      ]),
      (directory) => documentsDirectlyIn({ repositoryRoot, directory }),
      { concurrency: "unbounded" },
    ),
    (documents) => documents.flat().toSorted(),
  );
