// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

const repositoryRoot = path.join(import.meta.dirname, "../../..");

export { repositoryRoot };
