import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentAccess } from "@repo/infra-cloudflare/operator";
import { stagedAs } from "@repo/infra-cloudflare/prefixed-stack";
import { GitHubApp, appProviders, originRepository, repositorySlug } from "@repo/infra-github";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect, Redacted } from "effect";

import { productionEnvironment, wikiPublisherApp } from "./src/features/wiki-publisher/index.ts";

const { config } = await Effect.runPromise(deploymentAccess());

export default Stack(
  `${config.prefix}-wiki-publisher`,
  { providers: appProviders, state: state() },
  stagedAs(
    config.prefix,
    Effect.gen(function* wikiPublisher() {
      const address = yield* Effect.orDie(originRepository(repositoryRoot));
      const publisher = yield* GitHubApp("WikiPublisher", wikiPublisherApp(address, config.prefix));
      const productionSecret = { ...address, environment: productionEnvironment };
      yield* GitHub.Secret("WikiPublishAppId", {
        ...productionSecret,
        name: deploymentKey.wikiPublishAppId,
        value: publisher.appId.pipe(Output.map((appId: number) => Redacted.make(String(appId)))),
      });
      yield* GitHub.Secret("WikiPublishPrivateKey", {
        ...productionSecret,
        name: deploymentKey.wikiPublishPrivateKey,
        value: publisher.privateKey,
      });
      yield* GitHub.Secret("WikiPublishRepository", {
        ...productionSecret,
        name: deploymentKey.wikiPublishRepository,
        value: Redacted.make(repositorySlug(address)),
      });
      return { wikiPublisher: publisher.slug };
    }),
  ),
);
