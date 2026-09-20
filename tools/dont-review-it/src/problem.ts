import type { RepositoryProblem } from "./repository-checks/index.ts";
export type { RepositoryProblem } from "./repository-checks/index.ts";

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
