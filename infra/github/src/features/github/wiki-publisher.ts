import { wikiPublishPermissions } from "@repo/config";

import { type RepositoryAddress, repositorySlug } from "./repository.ts";

import type { AppDefinition } from "./app-registration.ts";

const productionEnvironment = "production";

const wikiPublisherApp = (address: RepositoryAddress, prefix: string): AppDefinition => ({
  ...address,
  name: `${prefix} wiki publisher`,
  permissions: wikiPublishPermissions,
  url: `https://github.com/${repositorySlug(address)}`,
});

export { productionEnvironment, wikiPublisherApp };
