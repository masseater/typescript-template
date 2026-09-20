import path from "node:path";

const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const repositoryDirectory = path.join(import.meta.dirname, "../../../.local/d1");

const localDatabaseDirectory = (): string => {
  const override = process.env[localDatabaseVariable];
  return override === undefined || override === "" ? repositoryDirectory : path.resolve(override);
};

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabasePersistence = localDatabaseDirectory();

export { localDatabase, localDatabaseDirectory, localDatabasePersistence, localDatabaseVariable };
