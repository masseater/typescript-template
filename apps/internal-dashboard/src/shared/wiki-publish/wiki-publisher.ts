import { readWikiPublishConfig } from "@repo/config";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer } from "effect";

import { enqueuePullRequest, publishToGitHub, withdrawPullRequest } from "./github-publication.ts";
import { WikiPublishUnavailable } from "./wiki-publish-unavailable.ts";

import type { ConfigurationInvalid, WikiPublishConfig } from "@repo/config";
import type { WikiPublication } from "./github-publication.ts";
import type { WikiPublishFailed } from "./wiki-publish-failed.ts";
import type { WikiPublishKeyInvalid } from "./wiki-publish-key-invalid.ts";
import type { WikiPublishStale } from "./wiki-publish-stale.ts";
import type { WikiPublishUnreachable } from "./wiki-publish-unreachable.ts";

type GitHubFailure =
  | WikiPublishFailed
  | WikiPublishKeyInvalid
  | WikiPublishUnavailable
  | WikiPublishUnreachable;

interface WikiPublisherShape {
  readonly enqueue: (pullRequest: number) => Effect.Effect<void, GitHubFailure>;
  readonly publish: (
    publication: WikiPublication,
  ) => Effect.Effect<Readonly<{ number: number; url: string }>, GitHubFailure | WikiPublishStale>;
  readonly publishable: boolean;
  readonly withdraw: (pullRequest: number) => Effect.Effect<void, GitHubFailure>;
}

const unavailable = (): Effect.Effect<never, WikiPublishUnavailable> =>
  Effect.fail(new WikiPublishUnavailable());

class WikiPublisher extends Context.Service<WikiPublisher, WikiPublisherShape>()(
  "#shared/wiki-publish/WikiPublisher",
) {
  public static layer(config: WikiPublishConfig | undefined): Layer.Layer<WikiPublisher> {
    return Layer.succeed(
      WikiPublisher,
      WikiPublisher.of(
        config === undefined
          ? {
              enqueue: unavailable,
              publish: unavailable,
              publishable: false,
              withdraw: unavailable,
            }
          : {
              enqueue: (pullRequest) => enqueuePullRequest(config, pullRequest),
              publish: (publication) =>
                publishToGitHub(config, publication).pipe(
                  withSpan("wiki.publish", { attributes: { page: publication.pagePath } }),
                ),
              publishable: true,
              withdraw: (pullRequest) => withdrawPullRequest(config, pullRequest),
            },
      ),
    );
  }

  public static fromEnvironment(env: unknown): Layer.Layer<WikiPublisher, ConfigurationInvalid> {
    return Layer.unwrap(
      Effect.map(readWikiPublishConfig(env), (config) => WikiPublisher.layer(config)),
    );
  }
}

export { WikiPublisher };
