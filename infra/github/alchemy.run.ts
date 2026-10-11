import { Resource, Stack } from "alchemy";
import { providers as cloudflareProviders, state } from "alchemy/Cloudflare";
import {
  GitHubCredentials,
  GitHubEnv,
  Ruleset,
  providers as gitHubProviders,
} from "alchemy/GitHub";
import { succeed } from "alchemy/Provider";
import { Effect, Layer } from "effect";

type Policy = "all" | "collaborators_only";

interface PullRequestCreationPolicyProps {
  owner: string;
  repository: string;
  policy: Policy;
}

const PullRequestCreationPolicy = Resource<
  Resource<"GitHub.PullRequestCreationPolicy", PullRequestCreationPolicyProps, { policy: Policy }>
>("GitHub.PullRequestCreationPolicy");

const updatePolicy = Effect.fn(function* updatePolicy(
  { owner, repository }: Readonly<Omit<PullRequestCreationPolicyProps, "policy">>,
  policy: Policy,
) {
  const credentials = yield* yield* GitHubCredentials;
  yield* Effect.tryPromise(() =>
    credentials.octokit().request("PATCH /repos/{owner}/{repo}", {
      owner,
      repo: repository,
      pull_request_creation_policy: policy,
    }),
  );
  return { policy };
});

const pullRequestCreationPolicyProvider = succeed(PullRequestCreationPolicy, {
  reconcile: Effect.fn(function* reconcile({ news }) {
    return yield* updatePolicy(news, news.policy);
  }),
  delete: Effect.fn(function* remove({ olds }) {
    yield* updatePolicy(olds, "all");
  }),
});

const gitHub = Layer.provideMerge(pullRequestCreationPolicyProvider, gitHubProviders());

export default Stack(
  "typescript-template-github",
  { providers: Layer.mergeAll(cloudflareProviders(), gitHub), state: state() },
  Effect.gen(function* stack() {
    const { owner, repository } = yield* Effect.fromNullishOr(yield* GitHubEnv).pipe(Effect.orDie);
    yield* PullRequestCreationPolicy("PullRequestCreationPolicy", {
      owner,
      repository,
      policy: "collaborators_only",
    });
    yield* Ruleset("ProtectDefaultBranch", {
      owner,
      repository,
      name: "protect default branch",
      conditions: { include: ["~DEFAULT_BRANCH"] },
      rules: { deletion: true, nonFastForward: true },
    });
  }),
);
