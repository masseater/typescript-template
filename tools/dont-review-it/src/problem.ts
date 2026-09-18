import type { RepositoryProblem } from "@repo/repository-checks";

export type { RepositoryProblem } from "@repo/repository-checks";

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;
