import { filePathOf } from "../platform/path.ts";

const repositoryRoot = filePathOf(new URL("../../../../../../", import.meta.url));

export { repositoryRoot };
