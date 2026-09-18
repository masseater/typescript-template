import type { Effect } from "effect";

import type { Database } from "@template/db";

type Run = <Value, Failure>(effect: Effect.Effect<Value, Failure, Database>) => Promise<Value>;

export type { Run };
