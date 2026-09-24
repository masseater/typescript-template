import { isResolved } from "alchemy/Diff";
import { type Providers, GitHubCredentials } from "alchemy/GitHub";
import * as Provider from "alchemy/Provider";
import { type Resource as ResourceType, Resource } from "alchemy/Resource";
import { Duration, Effect, type Layer } from "effect";

import { ensureInstallation, uninstall } from "./app-installation.ts";
import {
  type AppDefinition,
  type RegisteredApp,
  registerApp,
  replacesApp,
} from "./app-registration.ts";

type GitHubApp = ResourceType<"Repo.GitHubApp", AppDefinition, RegisteredApp, never, Providers>;

const GitHubApp = Resource<GitHubApp>("Repo.GitHubApp");

const pollInterval = Duration.seconds(3);
const humanStepTimeout = Duration.minutes(15);

const gitHubAppProvider = (): Layer.Layer<Provider.Provider<GitHubApp>, never, GitHubCredentials> =>
  Provider.succeed(GitHubApp, {
    delete: Effect.fn(function* deleteGitHubApp({ output, session }) {
      if (output.installationId !== undefined) {
        yield* uninstall(output, output.installationId);
      }
      yield* session.note(
        `GitHub has no API to delete an App; delete ${output.slug} from its GitHub settings`,
      );
    }),
    diff: ({ news, olds, output }) =>
      Effect.succeed(
        isResolved(news) && replacesApp(olds, news)
          ? ({ action: "replace" } as const)
          : output?.installationId === undefined
            ? ({ action: "update" } as const)
            : undefined,
      ),
    reconcile: Effect.fn(function* reconcileGitHubApp({ news, output, session }) {
      const credentials = yield* yield* GitHubCredentials;
      const wait = { announce: session.note, pollInterval, timeout: humanStepTimeout };
      if (output === undefined) {
        return yield* registerApp(news, {
          manifestTimeout: humanStepTimeout,
          token: credentials.token,
          wait,
        });
      }
      const installationId = yield* ensureInstallation({
        address: news,
        app: output,
        slug: output.slug,
        token: credentials.token,
        wait,
      });
      return { ...output, installationId };
    }),
  });

export { GitHubApp, gitHubAppProvider };
