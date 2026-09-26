import { homedir } from "node:os";

import {
  cloudflareEnvironmentFile,
  cloudflareEnvironmentFileVariable,
  configurationHome as configurationHomeSetting,
  processSetting,
} from "@repo/config/process-environment";

import { path } from "./platform.ts";

const secretsFileConfigured = (): boolean =>
  processSetting(cloudflareEnvironmentFile) !== undefined;

const configurationHome = (project: string): string =>
  path.join(processSetting(configurationHomeSetting) ?? path.join(homedir(), ".config"), project);

const ENVIRONMENT_FILE_NAME = "cloudflare.env";

const secretsFile = (project: string): string => {
  const configured = processSetting(cloudflareEnvironmentFile);
  return configured === undefined
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
};

export {
  cloudflareEnvironmentFileVariable as ENVIRONMENT_FILE_VARIABLE,
  secretsFile,
  secretsFileConfigured,
};
