import { Predicate } from "effect";

const field = (declared: unknown, key: string): unknown =>
  Predicate.isObject(declared) ? Object.getOwnPropertyDescriptor(declared, key)?.value : undefined;

export { field };
