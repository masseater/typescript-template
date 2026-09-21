import { Effect } from "effect";

import { query } from "./database.ts";
import { user } from "./schema.ts";

const checkDatabase = Effect.fn("checkDatabase")(function* checkDatabase() {
  yield* query((database) => database.select({ id: user.id }).from(user).limit(1));
});

export { checkDatabase };
