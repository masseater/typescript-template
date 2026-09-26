import { repositoryRoot } from "@repo/config/repository-root";
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
import {
  operatorLogin,
  originRepository,
  repositoryStage,
} from "./src/features/github/repository.ts";
import { mainBranchRuleset, rulesApplyEnvironmentSettings } from "./src/features/github/rules.ts";

export default Stack(
  "github",
  { providers: rulesetProviders, state: state() },
  Effect.gen(function* githubRules() {
    const address = yield* Effect.orDie(originRepository(repositoryRoot));
    return yield* stagedAs(
      repositoryStage(address),
      Effect.gen(function* repositoryRules() {
        const mainRuleset = yield* GitHub.Ruleset("Main", mainBranchRuleset(address));
        yield* GitHub.Environment("RulesApply", rulesApplyEnvironmentSettings(address));
        const reviewer = yield* Effect.orDie(operatorLogin());
        for (const environment of removalApprovalEnvironments) {
          yield* GitHub.Environment(
            environment,
            removalApprovalEnvironment(address, { environment, reviewer }),
          );
        }
        return { rulesetId: mainRuleset.rulesetId };
      }),
    );
  }),
);
