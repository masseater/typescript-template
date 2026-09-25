import { deploymentAccess } from "@repo/infra-cloudflare/operator";
import {
  DeploymentEnvironment,
  GitHubApp,
  appProviders,
  environmentRef,
  repositorySlug,
  stackName,
  stagedAt,
  targetRepository,
} from "@repo/infra-github";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect, Redacted } from "effect";

import { wikiPublisherApp } from "./src/features/wiki-publisher/index.ts";

const { config } = await Effect.runPromise(deploymentAccess());

const publishTo = Effect.fn("publishWikiTo")(function* publishTo(
  environment: DeploymentEnvironment,
) {
  const address = yield* targetRepository;
  const publisher = yield* GitHubApp("WikiPublisher", wikiPublisherApp(address, config.prefix));
  const destination = { ...address, environment: yield* environmentRef(environment) };
  yield* GitHub.Secret("WikiPublishAppId", {
    ...destination,
    name: deploymentKey.wikiPublishAppId,
    value: publisher.appId.pipe(Output.map((appId: number) => Redacted.make(String(appId)))),
  });
  yield* GitHub.Secret("WikiPublishPrivateKey", {
    ...destination,
    name: deploymentKey.wikiPublishPrivateKey,
    value: publisher.privateKey,
  });
  yield* GitHub.Secret("WikiPublishRepository", {
    ...destination,
    name: deploymentKey.wikiPublishRepository,
    value: Redacted.make(repositorySlug(address)),
  });
  return { wikiPublisher: publisher.slug };
});

export default Stack(
  stackName("wiki-publisher"),
  { providers: appProviders, state: state() },
  stagedAt(DeploymentEnvironment, publishTo),
);
