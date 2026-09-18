import { Database } from "@template/db";
import { Context, Effect, Layer } from "effect";

import { AuthFailure } from "./auth-failure.ts";
import { createAuth, type AuthOptions, type BetterAuthInstance } from "./create-auth.ts";

import type { Application } from "@template/config";

type AuthShape = {
  readonly audience: Application;
  readonly instance: BetterAuthInstance;
};

class Auth extends Context.Service<Auth, AuthShape>()("@template/auth/Auth") {
  public static layer(options: AuthOptions): Layer.Layer<Auth, AuthFailure, Database> {
    return Layer.effect(
      Auth,
      Effect.gen(function* authLayer() {
        const database = yield* Database;
        const context = yield* Effect.context<Database>();
        const instance = createAuth(options, database, Effect.runPromiseWith(context));
        yield* Effect.tryPromise({
          catch: (cause) => new AuthFailure({ cause }),
          try: async () => instance.$context,
        });
        return Auth.of({ audience: options.audience, instance });
      }),
    );
  }
}

export { Auth };
