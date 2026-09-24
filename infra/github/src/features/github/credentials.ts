import * as GitHub from "alchemy/GitHub";
import { collection } from "alchemy/Provider";
import { Effect, Layer, Redacted, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { GitHubApp, gitHubAppProvider } from "./github-app.ts";

class CredentialsFailure extends Schema.TaggedError<CredentialsFailure>()("CredentialsFailure", {
  code: Schema.Literals(["gh_token_unavailable"]),
}) {}

const ghCliToken = Effect.fn("ghCliToken")(function* ghCliToken() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const tokenText = yield* spawner
    .string(ChildProcess.make("gh", ["auth", "token"]))
    .pipe(Effect.mapError(() => new CredentialsFailure({ code: "gh_token_unavailable" })));
  const token = tokenText.trim();
  if (token === "") {
    return yield* new CredentialsFailure({ code: "gh_token_unavailable" });
  }
  return Redacted.make(token);
});

const credentials = Layer.unwrap(Effect.map(ghCliToken(), (token) => GitHub.fromToken(token)));

const rulesetProviders = Layer.effect(GitHub.Providers, collection([GitHub.Ruleset])).pipe(
  Layer.provide(GitHub.RulesetProvider()),
  Layer.provideMerge(credentials),
  Layer.orDie,
);

const appProviders = Layer.effect(GitHub.Providers, collection([GitHub.Secret, GitHubApp])).pipe(
  Layer.provide(Layer.merge(GitHub.SecretProvider(), gitHubAppProvider())),
  Layer.provideMerge(credentials),
  Layer.orDie,
);

export { appProviders, rulesetProviders };
