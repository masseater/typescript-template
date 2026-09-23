import { Effect, FileSystem } from "effect";
import { applyEdits, modify, type ModificationOptions } from "jsonc-parser";

import { failureMessageOf } from "../platform/file-system.ts";
import {
  composedPrefixOf,
  wrapperNameOf,
  type EntryCompositionConfig,
  type EntryCompositionLayer,
} from "./config.ts";
import { entryFindingsIn } from "./entry-composition-problems.ts";
import { readEntryManifests, type EntryManifest } from "./entry-manifests.ts";

import type { TreeFailure } from "../platform/directory-entries.ts";

export type EntryCompositionWriteReport = {
  readonly failures: readonly string[];
};

const MODIFICATION_OPTIONS: ModificationOptions = {
  formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
};

const strippedRestOf = ({
  value: held,
  ownNames,
  separator,
}: {
  readonly value: string;
  readonly ownNames: readonly string[];
  readonly separator: string;
}): string => {
  const separatorIndex = held.indexOf(separator);
  if (separatorIndex === -1) return held;
  return ownNames.includes(wrapperNameOf(held.slice(0, separatorIndex)))
    ? strippedRestOf({
        value: held.slice(separatorIndex + separator.length),
        ownNames,
        separator,
      })
    : held;
};

const composedValueOf = ({
  value: held,
  layer,
  config,
}: {
  readonly value: string;
  readonly layer: EntryCompositionLayer;
  readonly config: EntryCompositionConfig;
}): string | null => {
  const ownNames = layer.wrappers.map(wrapperNameOf);
  const foreignNames = [config.rootLayer, config.workspaceLayer]
    .flatMap((declared) => declared.wrappers)
    .map(wrapperNameOf)
    .filter((spelled) => !ownNames.includes(spelled));
  const separatorIndex = held.indexOf(config.wrapperSeparator);
  const headName = wrapperNameOf(separatorIndex === -1 ? held : held.slice(0, separatorIndex));
  if (foreignNames.includes(headName)) return null;

  const rest = strippedRestOf({ value: held, ownNames, separator: config.wrapperSeparator });
  return `${composedPrefixOf({ layer, config })}${rest}`;
};

const editedEntriesOf = ({
  manifest,
  config,
}: {
  readonly manifest: EntryManifest;
  readonly config: EntryCompositionConfig;
}): readonly (readonly [string, string])[] => {
  const { layer } = manifest;
  const prefix = composedPrefixOf({ layer, config });
  return entryFindingsIn({ manifest, config }).flatMap((finding) => {
    if (finding.kind !== "prefix-mismatch") {
      return [[finding.entryName, `${prefix}${config.placeholderBody}`] as const];
    }
    const composed = composedValueOf({ value: finding.value, layer, config });
    return composed === null ? [] : [[finding.entryName, composed] as const];
  });
};

export const writeEntryComposition = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: EntryCompositionConfig;
}): Effect.Effect<EntryCompositionWriteReport, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* writeEntryComposition() {
    const filesystem = yield* FileSystem.FileSystem;
    const listing = yield* readEntryManifests({ repositoryRoot, config });
    const writeFailures = yield* Effect.forEach(listing.manifests, (manifest) => {
      const rewritten = editedEntriesOf({ manifest, config }).reduce(
        (writtenText, [entryName, held]) =>
          applyEdits(
            writtenText,
            modify(writtenText, [config.scriptsKey, entryName], held, MODIFICATION_OPTIONS),
          ),
        manifest.source,
      );
      if (rewritten === manifest.source) return Effect.succeed([]);
      return filesystem.writeFileString(manifest.absolutePath, rewritten).pipe(
        Effect.as([]),
        Effect.catch((unwritable) =>
          Effect.succeed([
            `${manifest.relativePath} could not be rewritten: ${failureMessageOf(unwritable)}`,
          ]),
        ),
      );
    });

    return { failures: [...listing.failures, ...writeFailures.flat()].toSorted() };
  });
