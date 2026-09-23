import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));

export { repositoryRoot };
