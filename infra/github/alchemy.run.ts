import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentAccess } from "@repo/infra-cloudflare/operator";
import { stagedAs } from "@repo/infra-cloudflare/prefixed-stack";
import { Stack } from "alchemy";
import { state } from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect } from "effect";

import { rulesetProviders } from "./src/features/github/credentials.ts";
import {
  removalApprovalEnvironment,
  removalApprovalEnvironments,
} from "./src/features/github/removal-approval.ts";
import { operatorLogin, originRepository } from "./src/features/github/repository.ts";
import { mainBranchRuleset } from "./src/features/github/rules.ts";

const { config } = await Effect.runPromise(deploymentAccess());

export default Stack(
  `${config.prefix}-github`,
  { providers: rulesetProviders, state: state() },
  stagedAs(
    config.prefix,
    Effect.gen(function* githubRules() {
      const address = yield* Effect.orDie(originRepository(repositoryRoot));
      const mainRuleset = yield* GitHub.Ruleset("Main", mainBranchRuleset(address));
      const reviewer = yield* Effect.orDie(operatorLogin());
      for (const environment of removalApprovalEnvironments) {
        yield* GitHub.Environment(
          environment,
          removalApprovalEnvironment(address, { environment, reviewer }),
        );
      }
      return { rulesetId: mainRuleset.rulesetId };
    }),
  ),
);
