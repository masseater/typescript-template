// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { homedir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";

const environmentFile = (): string | undefined => {
  // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
  const configured = process.env[ENVIRONMENT_FILE_VARIABLE];
  return configured === undefined || configured === "" ? undefined : configured;
};

const secretsFileConfigured = (): boolean => environmentFile() !== undefined;

const configurationHome = (project: string): string => {
  // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
  const base = process.env["XDG_CONFIG_HOME"];
  return path.join(
    base === undefined || base === "" ? path.join(homedir(), ".config") : base,
    project,
  );
};

const ENVIRONMENT_FILE_NAME = "cloudflare.env";

const secretsFile = (project: string): string => {
  const configured = environmentFile();
  return configured === undefined
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
};

export { ENVIRONMENT_FILE_VARIABLE, secretsFile, secretsFileConfigured };
