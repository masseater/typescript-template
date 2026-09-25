import { wikiPublishPermissions } from "@repo/config";
import { type AppDefinition, type RepositoryAddress, repositorySlug } from "@repo/infra-github";

const wikiPublisherApp = (address: RepositoryAddress, prefix: string): AppDefinition => ({
  ...address,
  name: `${prefix} wiki publisher`,
  permissions: wikiPublishPermissions,
  url: `https://github.com/${repositorySlug(address)}`,
});

export { wikiPublisherApp };
