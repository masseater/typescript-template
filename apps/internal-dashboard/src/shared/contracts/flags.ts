import { flagKeys } from "@repo/feature-flags/definitions";
import { Schema } from "effect";

const FlagKey = Schema.Literals(flagKeys);

const FlagEntry = Schema.Struct({
  description: Schema.String,
  enabled: Schema.Boolean,
  key: FlagKey,
});

const FlagList = Schema.Struct({
  flags: Schema.Array(FlagEntry),
});

const FlagToggle = Schema.Struct({
  enabled: Schema.Boolean,
  key: FlagKey,
});

const FlagToggled = FlagEntry;

export { FlagEntry, FlagList, FlagToggle, FlagToggled };
