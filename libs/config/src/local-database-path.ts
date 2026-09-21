// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const repositoryDirectory = path.join(import.meta.dirname, "../../../.local/d1");

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabaseDirectory = (
  // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string => {
  const override = environment[localDatabaseVariable];
  return override === undefined || override === "" ? repositoryDirectory : path.resolve(override);
};

const localDatabasePersistence = localDatabaseDirectory();

export { localDatabase, localDatabaseDirectory, localDatabasePersistence, localDatabaseVariable };
