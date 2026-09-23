import { Context } from "effect";

export type GenerateId =
  | "serial"
  | "uuid"
  | false
  | ((options: { readonly model: string; readonly size?: number | undefined }) => string | false);

export const AuthIdentifiers = Context.Reference<GenerateId>("@repo/auth/AuthIdentifiers", {
  defaultValue: () => "uuid",
});
