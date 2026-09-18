import { Context } from "effect";

import type { BetterAuthAdvancedOptions } from "better-auth";

export type GenerateId = NonNullable<
  NonNullable<BetterAuthAdvancedOptions["database"]>["generateId"]
>;

export const AuthIdentifiers = Context.Reference<GenerateId>("@repo/auth/AuthIdentifiers", {
  defaultValue: () => "uuid",
});
