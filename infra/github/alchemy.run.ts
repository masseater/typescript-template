import { Stack } from "alchemy";
import { providers as cloudflareProviders, state } from "alchemy/Cloudflare";
import { Repository, Ruleset, providers as gitHubProviders } from "alchemy/GitHub";
import { Effect, Layer } from "effect";

const owner = "masseater";
const name = "typescript-template";

export default Stack(
  "typescript-template-github",
  { providers: Layer.mergeAll(cloudflareProviders(), gitHubProviders()), state: state() },
  Effect.gen(function* stack() {
    const repository = yield* Repository("Repository", {
      owner,
      name,
      pullRequestCreationPolicy: "collaborators_only",
    });
    yield* Ruleset("ProtectDefaultBranch", {
      owner,
      repository: name,
      name: "protect default branch",
      conditions: { include: ["~DEFAULT_BRANCH"] },
      rules: { deletion: true, nonFastForward: true },
    });
    return { url: repository.htmlUrl };
  }),
);
