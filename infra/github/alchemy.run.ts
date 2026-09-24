import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentAccess } from "@repo/infra-cloudflare/operator";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect, Redacted } from "effect";

import { providers } from "./src/features/github/credentials.ts";
import { GitHubApp } from "./src/features/github/github-app.ts";
import { originRepository, repositorySlug } from "./src/features/github/repository.ts";
import { mainBranchRuleset } from "./src/features/github/rules.ts";
import { productionEnvironment, wikiPublisherApp } from "./src/features/github/wiki-publisher.ts";

const { config } = await Effect.runPromise(deploymentAccess());

export default Stack(
  `${config.prefix}-github`,
  { providers, state: state() },
  Effect.gen(function* githubRules() {
    const address = yield* Effect.orDie(originRepository(repositoryRoot));
    const mainRuleset = yield* GitHub.Ruleset("Main", mainBranchRuleset(address));
    const wikiPublisher = yield* GitHubApp(
      "WikiPublisher",
      wikiPublisherApp(address, config.prefix),
    );
    const productionSecret = { ...address, environment: productionEnvironment };
    yield* GitHub.Secret("WikiPublishAppId", {
      ...productionSecret,
      name: deploymentKey.wikiPublishAppId,
      value: wikiPublisher.appId.pipe(Output.map((appId: number) => Redacted.make(String(appId)))),
    });
    yield* GitHub.Secret("WikiPublishPrivateKey", {
      ...productionSecret,
      name: deploymentKey.wikiPublishPrivateKey,
      value: wikiPublisher.privateKey,
    });
    yield* GitHub.Secret("WikiPublishRepository", {
      ...productionSecret,
      name: deploymentKey.wikiPublishRepository,
      value: Redacted.make(repositorySlug(address)),
    });
    return { rulesetId: mainRuleset.rulesetId, wikiPublisher: wikiPublisher.slug };
  }),
);
