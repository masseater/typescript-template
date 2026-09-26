import { DateTime, Effect } from "effect";

const clockDate = Effect.map(DateTime.now, DateTime.toDate);

export { clockDate };
