import * as GitHub from "alchemy/GitHub";
import { collection } from "alchemy/Provider";
import { Config, Effect, Layer, Schema } from "effect";

import { GitHubApp, gitHubAppProvider } from "./github-app.ts";

const gitHubToken = Config.schema(Schema.Redacted(Schema.NonEmptyString), "GITHUB_TOKEN");

const credentials = Layer.unwrap(
  Effect.gen(function* tokenCredentials() {
    return GitHub.fromToken(yield* gitHubToken);
  }),
);

const repositoryProviders = Layer.effect(
  GitHub.Providers,
  collection([GitHub.Ruleset, GitHub.Environment]),
).pipe(
  Layer.provide(Layer.merge(GitHub.RulesetProvider(), GitHub.EnvironmentProvider())),
  Layer.provideMerge(credentials),
  Layer.orDie,
);

const appProviders = Layer.effect(GitHub.Providers, collection([GitHub.Secret, GitHubApp])).pipe(
  Layer.provide(Layer.merge(GitHub.SecretProvider(), gitHubAppProvider())),
  Layer.provideMerge(credentials),
  Layer.orDie,
);

export { appProviders, gitHubToken, repositoryProviders };
