import { Database } from "@template/db";
import { Context, Effect, Layer } from "effect";

import { AuthFailure } from "./auth-failure.ts";
import { AuthIdentifiers } from "./auth-identifiers.ts";
import { createAuth, type AuthOptions, type BetterAuthInstance } from "./create-auth.ts";

import type { Application } from "@template/config";

export class Auth extends Context.Service<
  Auth,
  {
    readonly audience: Application;
    readonly instance: BetterAuthInstance;
  }
>()("@template/auth/Auth") {
  public static layer(authOptions: AuthOptions): Layer.Layer<Auth, AuthFailure, Database> {
    return Layer.effect(
      Auth,
      Effect.gen(function* authLayer() {
        const database = yield* Database;
        const databaseContext = yield* Effect.context<Database>();
        const betterAuthInstance = createAuth({
          authOptions,
          database,
          generateId: yield* AuthIdentifiers,
          run: Effect.runPromiseWith(databaseContext),
        });
        yield* Effect.tryPromise({
          catch: (cause) => new AuthFailure({ cause }),
          try: async () => betterAuthInstance.$context,
        });
        return Auth.of({ audience: authOptions.audience, instance: betterAuthInstance });
      }),
    );
  }
}
