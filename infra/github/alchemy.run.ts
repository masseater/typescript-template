import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentAccess } from "@repo/infra-cloudflare/operator";
import { Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect } from "effect";

import { providers } from "./src/features/github/credentials.ts";
import { originRepository } from "./src/features/github/repository.ts";
import { mainBranchRuleset } from "./src/features/github/rules.ts";

const { config } = await Effect.runPromise(deploymentAccess());

export default Stack(
  `${config.prefix}-github`,
  { providers, state: state() },
  Effect.gen(function* githubRules() {
    const address = yield* Effect.orDie(originRepository(repositoryRoot));
    const mainRuleset = yield* GitHub.Ruleset("Main", mainBranchRuleset(address));
    return { rulesetId: mainRuleset.rulesetId };
  }),
);
