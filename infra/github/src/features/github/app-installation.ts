import { GitHubInstallation, signGitHubAppJwt } from "@repo/config";
import { type Duration, Effect, type Redacted, Schedule, Schema } from "effect";

import { GitHubAppFailure, gitHubDelete, gitHubLookup, gitHubRequest } from "./github-api.ts";

import type { RepositoryAddress } from "./repository.ts";

type AppKey = Readonly<{ appId: number; privateKey: Redacted.Redacted }>;

type InstallationWait = Readonly<{
  announce: (message: string) => Effect.Effect<void>;
  pollInterval: Duration.Input;
  timeout: Duration.Input;
}>;

type InstallationTarget = Readonly<{
  address: RepositoryAddress;
  app: AppKey;
  wait: InstallationWait;
}>;

const OwnedRepository = Schema.Struct({
  id: Schema.Finite,
  owner: Schema.Struct({ id: Schema.Finite, type: Schema.Literals(["Organization", "User"]) }),
});

const ownedRepository = (
  address: RepositoryAddress,
  token: Redacted.Redacted,
): Effect.Effect<typeof OwnedRepository.Type, GitHubAppFailure> =>
  gitHubRequest(OwnedRepository, {
    method: "GET",
    path: `/repos/${address.owner}/${address.repository}`,
    step: "repository",
    token,
  });

const installationUrl = (slug: string, repository: typeof OwnedRepository.Type): string =>
  `https://github.com/apps/${slug}/installations/new/permissions?suggested_target_id=${String(
    repository.owner.id,
  )}&repository_ids[]=${String(repository.id)}`;

const appJwt = (appKey: AppKey): Effect.Effect<Redacted.Redacted, GitHubAppFailure> =>
  signGitHubAppJwt({ appId: String(appKey.appId), privateKey: appKey.privateKey }).pipe(
    Effect.mapError(
      (cause) => new GitHubAppFailure({ cause, code: "private_key_invalid", step: "jwt" }),
    ),
  );

const findInstallation = (
  appKey: AppKey,
  address: RepositoryAddress,
): Effect.Effect<number | undefined, GitHubAppFailure> =>
  appJwt(appKey).pipe(
    Effect.flatMap((jwt) =>
      gitHubLookup(GitHubInstallation, {
        method: "GET",
        path: `/repos/${address.owner}/${address.repository}/installation`,
        step: "installation",
        token: jwt,
      }),
    ),
    Effect.map((installation) => installation?.id),
  );

const installationTimeout = (): GitHubAppFailure =>
  new GitHubAppFailure({ code: "installation_timeout", step: "installation" });

const awaitInstallation = (
  appInstallation: InstallationTarget,
): Effect.Effect<number, GitHubAppFailure> =>
  findInstallation(appInstallation.app, appInstallation.address).pipe(
    Effect.filterOrFail((installedId) => installedId !== undefined, installationTimeout),
    Effect.retry({
      schedule: Schedule.spaced(appInstallation.wait.pollInterval),
      while: (failure) => failure.code === "installation_timeout",
    }),
    Effect.timeoutOrElse({
      duration: appInstallation.wait.timeout,
      orElse: () => Effect.fail(installationTimeout()),
    }),
  );

const ensureInstallation = Effect.fn("ensureGitHubAppInstallation")(function* ensureInstallation(
  appInstallation: InstallationTarget & Readonly<{ slug: string; token: Redacted.Redacted }>,
) {
  const installed = yield* findInstallation(appInstallation.app, appInstallation.address);
  if (installed !== undefined) {
    return installed;
  }
  const repository = yield* ownedRepository(appInstallation.address, appInstallation.token);
  yield* appInstallation.wait.announce(
    `Install the GitHub App on ${appInstallation.address.owner}/${appInstallation.address.repository}: ${installationUrl(
      appInstallation.slug,
      repository,
    )}`,
  );
  return yield* awaitInstallation(appInstallation);
});

const uninstall = (appKey: AppKey, installationId: number): Effect.Effect<void, GitHubAppFailure> =>
  appJwt(appKey).pipe(
    Effect.flatMap((jwt) =>
      gitHubDelete({
        method: "DELETE",
        path: `/app/installations/${String(installationId)}`,
        step: "uninstall",
        token: jwt,
      }),
    ),
  );

export { awaitInstallation, ensureInstallation, installationUrl, ownedRepository, uninstall };
export type { InstallationWait };
