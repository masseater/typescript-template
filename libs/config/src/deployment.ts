import { homedir } from "node:os";
import path from "node:path";

const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";
const ENVIRONMENT_FILE_NAME = "cloudflare.env";

const configurationHome = (project: string): string => {
  const base = process.env.XDG_CONFIG_HOME;
  return path.join(
    base === undefined || base === "" ? path.join(homedir(), ".config") : base,
    project,
  );
};

const secretsFile = (project: string): string => {
  const configured = process.env[ENVIRONMENT_FILE_VARIABLE];
  return configured === undefined || configured === ""
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
};

export { secretsFile };
