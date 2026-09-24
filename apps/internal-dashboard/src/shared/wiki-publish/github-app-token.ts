import { GitHubInstallation, signGitHubAppJwt, wikiPublishPermissions } from "@repo/config";
import { Effect, Redacted, Schema } from "effect";

import { gitHubRequest } from "./github-request.ts";
import { WikiPublishKeyInvalid } from "./wiki-publish-key-invalid.ts";

import type { WikiPublishConfig } from "@repo/config";

const InstallationToken = Schema.Struct({ token: Schema.String });

const installationToken = Effect.fn("gitHubInstallationToken")(function* installationToken(
  config: WikiPublishConfig,
) {
  const jwt = yield* signGitHubAppJwt(config).pipe(
    Effect.mapError(({ cause }) => new WikiPublishKeyInvalid({ cause })),
  );
  const installation = yield* gitHubRequest(GitHubInstallation, {
    method: "GET",
    path: `/repos/${config.owner}/${config.repository}/installation`,
    step: "installation",
    token: jwt,
  });
  const issued = yield* gitHubRequest(InstallationToken, {
    body: {
      permissions: wikiPublishPermissions,
      repositories: [config.repository],
    },
    method: "POST",
    path: `/app/installations/${String(installation.id)}/access_tokens`,
    step: "installation-token",
    token: jwt,
  });
  return Redacted.make(issued.token);
});

export { installationToken };
