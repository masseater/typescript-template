import { Effect, type Redacted, Schema } from "effect";

import { GitHubAppFailure, gitHubRequest } from "./github-api.ts";
import { type RepositoryAddress, repositorySlug } from "./repository.ts";

const Principal = Schema.Struct({ login: Schema.String });
const AdministeredRepository = Schema.Struct({
  permissions: Schema.Struct({ admin: Schema.Boolean }),
});

type OperatorAccess = Readonly<{ principal: string; repository: string }>;

const tokenPrincipal = (token: Redacted.Redacted): Effect.Effect<string, GitHubAppFailure> =>
  gitHubRequest(Principal, { method: "GET", path: "/user", step: "principal", token }).pipe(
    Effect.map((principal) => principal.login),
  );

const operatorAccess = Effect.fn("gitHubOperatorAccess")(function* operatorAccess(
  address: RepositoryAddress,
  token: Redacted.Redacted,
) {
  const principal = yield* tokenPrincipal(token);
  const repository = yield* gitHubRequest(AdministeredRepository, {
    method: "GET",
    path: `/repos/${repositorySlug(address)}`,
    step: "repository",
    token,
  });
  if (!repository.permissions.admin) {
    return yield* new GitHubAppFailure({ code: "admin_permission_missing", step: "repository" });
  }
  return { principal, repository: repositorySlug(address) } satisfies OperatorAccess;
});

export { operatorAccess, tokenPrincipal };
export type { OperatorAccess };
