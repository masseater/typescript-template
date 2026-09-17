// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const errorWorkerArtifact = path.join(import.meta.dirname, "../dist/index.js");

export { errorWorkerArtifact };
