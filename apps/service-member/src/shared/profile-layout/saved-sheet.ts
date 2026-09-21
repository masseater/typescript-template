import { Effect, Option, Schema } from "effect";

import { Sheet } from "#shared/interview/sheet.ts";
import { ProfileLayout } from "./schema.ts";

import type { SheetData } from "#shared/interview/sheet.ts";
import type { ProfileLayoutData } from "./schema.ts";

const StoredSheet = Schema.Struct({
  layout: ProfileLayout,
  sheet: Sheet,
});

const decodeStored = Schema.decodeUnknownOption(StoredSheet);
const decodeLegacy = Schema.decodeUnknownOption(Sheet);

function readSavedSheet(
  saved: unknown,
): Readonly<{ layout?: ProfileLayoutData; sheet: SheetData }> {
  const stored = Option.getOrUndefined(decodeStored(saved));
  if (stored !== undefined) {
    return stored;
  }
  const legacy = Option.getOrUndefined(decodeLegacy(saved));
  if (legacy !== undefined) {
    return { sheet: legacy };
  }
  return { sheet: {} };
}

const encodeStored = Schema.encodeEffect(StoredSheet);

function writeSavedSheet(
  sheet: SheetData,
  layout: ProfileLayoutData,
): Effect.Effect<typeof StoredSheet.Type> {
  return encodeStored({ layout, sheet });
}

export { readSavedSheet, writeSavedSheet };
