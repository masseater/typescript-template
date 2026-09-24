import { NodeServices } from "@effect/platform-node";
import { wikiPublishPermissions } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { productionEnvironment, wikiPublisherApp } from "./index.ts";

describe("wikiPublisherApp", () => {
  const it = test.extend("publisherApp", () =>
    wikiPublisherApp({ owner: "acme", repository: "widgets" }, "acme"));

  it("asks for exactly the permissions the wiki publisher uses", ({ publisherApp }) => {
    expect(publisherApp).toStrictEqual({
      name: "acme wiki publisher",
      owner: "acme",
      permissions: wikiPublishPermissions,
      repository: "widgets",
      url: "https://github.com/acme/widgets",
    });
  });
});

describe("the deploy workflow", () => {
  const it = test.extend("secretsMissingFromProduction", () =>
    Effect.runPromise(
      Effect.gen(function* productionJob() {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const workflow = yield* fileSystem.readFileString(
          path.join(repositoryRoot, ".github/workflows/deploy.yml"),
        );
        const productionSteps = workflow.slice(
          workflow.indexOf(`environment: ${productionEnvironment}`),
        );
        return [
          deploymentKey.wikiPublishAppId,
          deploymentKey.wikiPublishPrivateKey,
          deploymentKey.wikiPublishRepository,
        ].filter((secretName) => !productionSteps.includes(`\${{ secrets.${secretName} }}`));
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("hands every secret of the App to the production deploy", ({
    secretsMissingFromProduction,
  }) => {
    expect(secretsMissingFromProduction).toStrictEqual([]);
  });
});
