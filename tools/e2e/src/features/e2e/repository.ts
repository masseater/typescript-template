import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, Path } from "effect";

import type { Application } from "@repo/config";

const paths = Effect.runSync(Effect.provide(Path.Path, NodeServices.layer));

const applicationRoot = (application: Application): string =>
  paths.join(repositoryRoot, "apps", application);

const vitePlus = paths.join(repositoryRoot, "node_modules/.bin/vp");

export { applicationRoot, repositoryRoot, vitePlus };
