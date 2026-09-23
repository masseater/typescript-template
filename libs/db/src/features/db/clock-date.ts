import { Clock, Effect } from "effect";

const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

export { clockDate };
