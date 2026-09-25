import { RemovalPolicy, Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect, Schema } from "effect";

import { tokenPrincipal } from "./src/features/github/access.ts";
import {
  deploymentEnvironments,
  repositoryStage,
  stackName,
  stagedAt,
} from "./src/features/github/apply-target.ts";
import { gitHubToken, repositoryProviders } from "./src/features/github/credentials.ts";
import { targetRepository } from "./src/features/github/repository.ts";
import { deploymentEnvironmentSettings, mainBranchRuleset } from "./src/features/github/rules.ts";

const repositorySettings = Effect.gen(function* repositorySettings() {
  const address = yield* targetRepository;
  const approver = yield* Effect.orDie(tokenPrincipal(yield* gitHubToken));
  const mainRuleset = yield* GitHub.Ruleset("Main", mainBranchRuleset(address));
  const environments = deploymentEnvironmentSettings(address, approver);
  const declared = yield* Effect.forEach(deploymentEnvironments, (environment) =>
    GitHub.Environment(environment, environments[environment]).pipe(RemovalPolicy.retain()),
  );
  return {
    environments: declared.map((environment) => environment.name),
    rulesetId: mainRuleset.rulesetId,
  };
});

export default Stack(
  stackName("github"),
  { providers: repositoryProviders, state: state() },
  stagedAt(Schema.Literal(repositoryStage), () => repositorySettings),
);
