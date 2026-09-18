import type { RepositoryProblem } from "@template/repository-checks";

export type { RepositoryProblem } from "@template/repository-checks";

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
