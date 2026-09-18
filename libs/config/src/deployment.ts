// oxlint-disable-next-line import/no-nodejs-modules
import { homedir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";
const ENVIRONMENT_FILE_NAME = "cloudflare.env";

function configurationHome(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const base = process.env["XDG_CONFIG_HOME"];
  return path.join(
    base === undefined || base === "" ? path.join(homedir(), ".config") : base,
    project,
  );
}

function secretsFile(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const configured = process.env[ENVIRONMENT_FILE_VARIABLE];
  return configured === undefined || configured === ""
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
}

export { secretsFile };
