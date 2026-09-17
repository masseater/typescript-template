import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer, Schema } from "effect";
import { schema, user } from "./schema.ts";

export { schema } from "./schema.ts";

const connect = (binding: D1Database) => drizzle(binding, { schema });

export type DrizzleDatabase = ReturnType<typeof connect>;

export class Database extends Context.Service<Database, DrizzleDatabase>()(
  "@template/db/Database",
) {
  static layer(binding: D1Database) {
    return Layer.sync(Database, () => connect(binding));
  }
}

export class DatabaseFailure extends Schema.TaggedError<DatabaseFailure>()("DatabaseFailure", {
  cause: Schema.Defect(),
}) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {}) {}

export const query = <A>(run: (database: DrizzleDatabase) => PromiseLike<A>) =>
  Database.use((database) =>
    Effect.tryPromise({
      try: () => Promise.resolve(run(database)),
      catch: (cause) => new DatabaseFailure({ cause }),
    }),
  );

const profileColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  profile: user.profile,
};

export const checkDatabase = Effect.fn("checkDatabase")(function* () {
  yield* query((database) => database.select({ id: user.id }).from(user).limit(1));
});

export const getProfile = Effect.fn("getProfile")(function* (userId: string) {
  const [profile] = yield* query((database) =>
    database.select(profileColumns).from(user).where(eq(user.id, userId)).limit(1),
  );
  return profile ?? null;
});

export const updateProfile = Effect.fn("updateProfile")(function* (
  userId: string,
  values: { readonly name: string; readonly profile: string },
) {
  const [profile] = yield* query((database) =>
    database
      .update(user)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning(profileColumns),
  );
  if (!profile) return yield* new UserNotFound();
  return profile;
});
