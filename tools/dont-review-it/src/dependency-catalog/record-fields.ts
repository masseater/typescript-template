export const isRecord = (declared: unknown): declared is Readonly<Record<string, unknown>> =>
  declared !== null && typeof declared === "object" && !Array.isArray(declared);

export const field = (declared: unknown, propertyName: string): unknown =>
  isRecord(declared) ? Object.getOwnPropertyDescriptor(declared, propertyName)?.value : undefined;

export const recordOf = (declared: unknown): Readonly<Record<string, unknown>> =>
  isRecord(declared) ? declared : {};

export const stringEntriesOf = (declared: unknown): readonly (readonly [string, string])[] =>
  Object.entries(recordOf(declared)).filter(
    (listed): listed is [string, string] => typeof listed[1] === "string",
  );
