import type { Effect } from "effect";

import type { Database } from "@repo/db";

type Run = <Value, Failure>(effect: Effect.Effect<Value, Failure, Database>) => Promise<Value>;

export type { Run };
