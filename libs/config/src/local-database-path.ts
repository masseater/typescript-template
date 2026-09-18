// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const repositoryDirectory = path.join(import.meta.dirname, "../../../.local/d1");

function localDatabaseDirectory(): string {
  // oxlint-disable-next-line node/no-process-env
  const override = process.env[localDatabaseVariable];
  return override === undefined || override === "" ? repositoryDirectory : path.resolve(override);
}

export { localDatabaseDirectory, localDatabaseVariable };
