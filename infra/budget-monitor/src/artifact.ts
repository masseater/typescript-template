import path from "node:path";

const budgetWorkerArtifact = path.join(import.meta.dirname, "../dist/index.js");

export { budgetWorkerArtifact };
