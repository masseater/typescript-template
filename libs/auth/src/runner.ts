import type { Database } from "@template/db";
import type { Effect } from "effect";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
type Run = <Value, Failure>(effect: Effect.Effect<Value, Failure, Database>) => Promise<Value>;

export type { Run };
