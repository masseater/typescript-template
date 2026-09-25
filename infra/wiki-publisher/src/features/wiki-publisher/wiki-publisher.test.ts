import { NodeServices } from "@effect/platform-node";
import { wikiPublishPermissions } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { deploymentEnvironments } from "@repo/infra-github";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { wikiPublisherApp } from "./index.ts";

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
  const wikiPublishKeys = [
    deploymentKey.wikiPublishAppId,
    deploymentKey.wikiPublishPrivateKey,
    deploymentKey.wikiPublishRepository,
  ];
  const it = test.extend("secretsByEnvironment", () =>
    Effect.runPromise(
      Effect.gen(function* environmentJobs() {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const workflow = yield* fileSystem.readFileString(
          path.join(repositoryRoot, ".github/workflows/deploy.yml"),
        );
        const starts = deploymentEnvironments
          .map((environment) => ({
            environment,
            start: workflow.indexOf(`environment: ${environment}`),
          }))
          .toSorted((left, right) => left.start - right.start);
        return Object.fromEntries(
          starts.map(({ environment, start }, index) => {
            const steps = workflow.slice(start, starts[index + 1]?.start);
            return [
              environment,
              wikiPublishKeys.filter((secretName) =>
                steps.includes(`\${{ secrets.${secretName} }}`),
              ),
            ];
          }),
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("hands every secret of the App to the production deploy and none to staging", ({
    secretsByEnvironment,
  }) => {
    expect(secretsByEnvironment).toStrictEqual({ production: wikiPublishKeys, staging: [] });
  });
});
